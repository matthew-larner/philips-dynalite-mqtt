import * as YAML from 'yaml';
import * as fs from 'fs';
import { MqttClient } from 'mqtt';

import mqtt from './mqtt';
import dynalite from './dynalite';
import * as util from './utils';

(async (): Promise<void> => {
  try {
    // Get and parse configuration
    const config = YAML.parse(fs.readFileSync('./config/configuration.yml', 'utf8'));
    const {
      mqtt: mqttConfig,
      dynalite: { bridges: [bridges] }
    } = config;

    const onMqttConnected = (client: MqttClient) => {
      const startupChannelPublish = () => {
        if (mqttConfig.discovery) {
          // publish every channels of dynalite.bridges[0].area keys
          const areaKeys = Object.keys(bridges.area);
          areaKeys.forEach(areaKey => {
            const channelKeys = Object.keys(bridges.area[areaKey].channel);
            channelKeys.forEach(channelKey => {
              const { type, name: channelName } = bridges.area[areaKey].channel[channelKey];
              const name = `${bridges.area[areaKey].name} ${channelName}`;

              let payload: object;
              let topic: string;

              if (type === 'light') {
                topic = `${mqttConfig.discovery_prefix}/${type}/${areaKey}/${channelKey}/config`;
                payload = {
                  "~": `${mqttConfig.topic_prefix}/${areaKey}/${channelKey}`,
                  name,
                  unique_id: name.toLowerCase().replace(/ /g, "_"),
                  cmd_t: "~/set",
                  stat_t: "~/state",
                  schema: "json",
                  brightness: true
                };
              } else if (type === 'motion') {
                topic = `${mqttConfig.discovery_prefix}/binary_sensor/${areaKey}/${channelKey}/config`;
                payload = {
                  name: `${bridges.area[areaKey].name} ${channelName}`,
                  device_class: "motion",
                  state_topic: `${mqttConfig.topic_prefix}/${areaKey}/${channelKey}/state`
                };
              } else {
                // skip other types
                console.log('Skipping type ', type);
                return;
              }

              client.publish(topic, JSON.stringify(payload), {
                qos: mqttConfig.qos,
                retain: mqttConfig.retain
              });
            });
          });
        };
      };

      const subscribeLightChannels = () => {
        // subscribe to area channels with type light
        const areaKeys = Object.keys(bridges.area);
        areaKeys.forEach(areaKey => {
          const channelKeys = Object.keys(bridges.area[areaKey].channel);
          channelKeys.forEach(channelKey => {
            if (bridges.area[areaKey].channel[channelKey].type === 'light') {
              const topic = `${mqttConfig.topic_prefix}/${areaKey}/${channelKey}/set`;

              client.subscribe(topic, (err) => {
                if (err) {
                  console.log(`Cannot subscribe to topic ${topic}: ${err}`);
                } else {
                  console.log('Subcribed to topic:', topic);
                }
              });
            }
          });
        });
      };

      startupChannelPublish();
      subscribeLightChannels();
    };
    const onMqttMessage = (topic: string, message: Buffer) => {
      try {
        const { brightness, state } = JSON.parse(message.toString());
        console.log("Topic:", topic, "Received message: ", message.toString());

        const [, area, channel] = topic.split('/');
        const fade = bridges.area[area].channel[channel].fade * 10;
        const channelLevel = !isNaN(brightness) ? brightness : (state === "ON" ? 0 : 255);
        const buffer = [28, parseInt(area), parseInt(channel) - 1, 113, channelLevel, fade, 255];
        const checkSum = parseInt(util.getChecksum(buffer.map(item => util.decimalToHex(item)).join('')), 16);
        buffer.push(checkSum);

        console.log("TCP command to be sent", buffer);

        dynaliteClient.write(Buffer.from(buffer));
      } catch (error) {
        console.error("onMqttMessage error:", error);
      }
    };

    const mqttClient = mqtt(mqttConfig, onMqttConnected, onMqttMessage);

    const publishLightState = (data: Buffer) => {
      const startByte = data[0];
      if (startByte === 172) {
        const area = data[7];
        const channel = data[11];
        const state = data[13] === 1 ? "ON" : "OFF";

        if (bridges.area[area] && bridges.area[area].channel[channel]) {
          const { type } = bridges.area[area].channel[channel];

          const payloadByType = {
            light: JSON.stringify({ state }),
            motion: state
          };
          const payload = payloadByType[type];
          const topic = `${mqttConfig.topic_prefix}/${area}/${channel}/state`;

          console.log(`Sending payload: ${payload} to topic: ${topic}`);

          mqttClient.publish(topic, payload, {
            qos: mqttConfig.qos,
            retain: mqttConfig.retain
          });
        } else {
          console.log(`Ignored message with area ${area} channel: ${channel}`);
        }
      } else {
        console.log('Ignored message starting with', startByte);
      }
    }

    const dynaliteClient = dynalite(bridges.host, bridges.port, publishLightState);

  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
})();

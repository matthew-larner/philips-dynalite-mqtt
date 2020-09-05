import * as YAML from 'yaml';
import * as fs from 'fs';
import { MqttClient } from 'mqtt';

import mqtt from './mqtt';
import dynalite from './dynalite';
import * as util from './utils';

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
              topic = `${mqttConfig.discovery_prefix}/${type}/a${areaKey}c${channelKey}/config`;
              payload = {
                "~": `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}`,
                name,
                unique_id: name.toLowerCase().replace(/ /g, "_"),
                cmd_t: "~/set",
                stat_t: "~/state",
                schema: "json",
                brightness: true
              };
            } else if (type === 'motion') {
              topic = `${mqttConfig.discovery_prefix}/binary_sensor/a${areaKey}c${channelKey}/config`;
              payload = {
                name: `${bridges.area[areaKey].name} ${channelName}`,
                device_class: "motion",
                state_topic: `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}/state`
              };
            } else {
              // skip other types
              console.log('Skipping type:', type);
              return;
            }

            console.log(`Sending payload: ${JSON.stringify(payload)} to topic: ${topic}`);

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
            const topic = `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}/set`;

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

  const mqttClient = mqtt(mqttConfig, onMqttConnected);
  const dynaliteClient = dynalite(bridges.host, bridges.port, bridges.reconnect_time);

  const handleHomeAssistantCommands = (topic: string, message: Buffer) => {
    try {
      console.log("Topic:", topic, "Received message: ", message.toString().replace(/\s/g, ''));

      const { brightness, state } = JSON.parse(message.toString());
      const [area, channel] = topic.split('/')[1].match(/\d+/g);
      const fade = bridges.area[area].channel[channel].fade * 10;

      const limitBrightness = (val: number) => val === 255 ? 254 : val;
      const channelLevel = !isNaN(brightness) ? 254 - limitBrightness(brightness) : state === "ON" ? 0 : 254;

      const buffer = util.createBuffer([28, parseInt(area), parseInt(channel) - 1, 113, channelLevel, fade, 255]);

      const sendMqttMessage = (err: Error) => {
        if (!err) {
          const mqttTopic = topic.replace('set', 'state');
          const payload = JSON.stringify({ state, brightness });

          mqttClient.publish(mqttTopic, payload);
        }
      };

      dynaliteClient.write(Buffer.from(buffer), sendMqttMessage);
    } catch (error) {
      console.error("handleHomeAssistantCommands error:", error);
    }
  };

  const handleDynaliteCommands = (data: Buffer) => {
    console.log('Received dynalite message:', data);

    const firstDecimal = data[0];

    if (firstDecimal === 172) {
      const thirdDecimal = data[2];
      const area = data[7];
      const channel = data[11];

      if (!bridges.area[area] || !bridges.area[area].channel[channel]) {
        console.log(`Ignored message with area: ${area} channel: ${channel}`);
        return;
      }

      const sendMqttMessage = (payload: string) => {
        const topic = `${mqttConfig.topic_prefix}/a${area}c${channel}/state`;

        mqttClient.publish(topic, payload);
      };

      const processLightAndMotionMessage = (code: number) => {
        const { type } = bridges.area[area].channel[channel];
        const createPayloadByType = (value: string) => ({
          light: JSON.stringify({ state: value }),
          motion: value
        });

        if (code === 1) {
          sendMqttMessage(createPayloadByType('ON')[type]);
        } else if (code === 4) {
          sendMqttMessage(createPayloadByType('OFF')[type]);
        } else if (code === 0) {
          const buffer = util.createBuffer([28, area, channel - 1, 97, 0, 0, 255]);

          dynaliteClient.write(Buffer.from(buffer));
        } else {
          console.log('Ignored message with 14th character decimal:', code);
        }
      };
      const processChannelFeedbackMessage = (brightness: number) => {
        let payload: object;
        if (brightness === 254) {
          payload = { state: "ON" };
        } else if (brightness === 0) {
          payload = { state: "OFF" };
        } else {
          payload = { state: "ON", brightness };
        }

        sendMqttMessage(JSON.stringify(payload));
      };

      if (thirdDecimal === 17) {
        processLightAndMotionMessage(data[13]);
      } else if (thirdDecimal === 35) {
        processChannelFeedbackMessage(data[14]);
      } else {
        console.log('Ignored message 3rd character decimal:', thirdDecimal);
      }
    } else {
      console.log('Ignored message 1st character with:', firstDecimal);
    }
  }

  mqttClient.onMessage(handleHomeAssistantCommands);
  dynaliteClient.onMessage(handleDynaliteCommands);

} catch (error) {
  console.error(error.message);
  process.exit(1);
}

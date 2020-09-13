import * as mqtt from "mqtt";

import { Handler } from '../contracts';

import * as util from './utils';

export const startup = ({
  mqttConfig,
  bridges
}) =>
  (client: mqtt.MqttClient) => {
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
            } else if (type === 'temperature') {
              topic = `${mqttConfig.discovery_prefix}/sensor/a${areaKey}c${channelKey}/config`;
              payload = {
                name: `${bridges.area[areaKey].name} ${channelName}`,
                device_class: "temperature",
                state_topic: `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}/temp`,
                unit_of_measurement: "°C"
              };
            } else {
              // skip other types
              console.log('Home Assistant Discovery skipping type:', type);
              return;
            }

            console.log(`Sending payload: ${JSON.stringify(payload)} to topic: ${topic}`);

            client.publish(topic, JSON.stringify(payload));
          });
        });
      };
    };

    const subscribeTopics = () => {
      // subscribe to area channels with type light, channel_level or hvac_setpoint
      const areaKeys = Object.keys(bridges.area);
      areaKeys.forEach(areaKey => {
        const channelKeys = Object.keys(bridges.area[areaKey].channel);
        channelKeys.forEach(channelKey => {
          if (['light', 'channel_level', 'hvac_setpoint'].includes(bridges.area[areaKey].channel[channelKey].type)) {
            const topic = `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}/set`;

            client.subscribe(topic, (err) => {
              if (err) {
                console.log(`Cannot subscribe to topic ${topic}: ${err}`);
              } else {
                console.log('Subscribed to topic:', topic);
              }
            });
          }
        });
      });
    };

    startupChannelPublish();
    subscribeTopics();
  };

export const commandsHandler = ({
  mqttClient,
  dynaliteClient,
  bridges
}: Handler) =>
  (topic: string, message: Buffer) => {
    try {
      console.log("Topic:", topic, "Received message: ", message.toString().replace(/\s/g, ''));

      const [area, channel] = topic.split('/')[1].match(/\d+/g);
      const areaNumber = parseInt(area);
      const channelNumber = parseInt(channel);
      const type = bridges.area[area].channel[channel].type;

      const sendMqttMessage = (data: object) => (err: Error) => {
        if (!err) {
          const mqttTopic = topic.replace('set', 'state');
          const payload = JSON.stringify(data);

          mqttClient.publish(mqttTopic, payload);
        }
      };

      const processLight = () => {
        const { brightness, state } = JSON.parse(message.toString());
        const fade = bridges.area[area].channel[channel].fade * 10;

        const limitMinimumBrightness = (val: number) => val < 1 ? 1 : val;
        const channelLevel = !isNaN(brightness) ? limitMinimumBrightness(255 - brightness) : state === "ON" ? 1 : 255;

        const buffer = util.createBuffer([28, areaNumber, channelNumber - 1, 113, channelLevel, fade, 255]);

        dynaliteClient.write(Buffer.from(buffer), sendMqttMessage({ state, brightness }));
      };
      const processChannelLevel = () => {
        const channelLevel = parseInt(message.toString());

        const buffer = util.createBuffer([28, areaNumber, channelNumber - 1, 113, channelLevel, 0, 255]);

        dynaliteClient.write(Buffer.from(buffer), sendMqttMessage({ channel_level: channelLevel }));
      };
      const processHvacSetpoint = () => {
        const hvacSetpoint = parseInt(message.toString());
        const temperature = Math.round(hvacSetpoint / 4);

        const buffer = util.createBuffer([172, 3, 86, 220, 0, 80, 0, areaNumber, 255, 13, temperature, channelNumber, 0, 0, 53]);

        dynaliteClient.write(Buffer.from(buffer), sendMqttMessage({ hvac_setpoint: hvacSetpoint }));
      };

      if (type === 'light') {
        processLight();
      } else if (type === 'channel_level') {
        processChannelLevel();
      } else if (type === 'hvac_setpoint') {
        processHvacSetpoint();
      } else {
        // this should not be reached unless subscribed to an unintended type

        console.log(`Home assistant ignoring unsupported type: ${type}`);
      }
    } catch (error) {
      console.error('Home assistant commandHandler error:', error);
    }
  };
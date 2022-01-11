import * as mqtt from "mqtt";

import { Handler } from '../contracts';

import * as util from './utils';

import * as dbmanager from './dbmanager';

export const startup = ({
  mqttConfig,
  bridges
}) =>
  (client: mqtt.MqttClient) => {
    const startupChannelPublish = () => {
      if (mqttConfig.discovery) {
        // publish every channels of dynalite.bridges[0].area keys
        const areaKeys = Object.keys(bridges.area);
        let sendonce: number;//used to prevent sending publish for rgbw of same channel
        let publish_topic: boolean;
        areaKeys.forEach(areaKey => {
          sendonce = 0;
          publish_topic = true;
          const channelKeys = Object.keys(bridges.area[areaKey].channel);
          channelKeys.forEach(channelKey => {
            const { type, name: channelName, mode: lightmode } = bridges.area[areaKey].channel[channelKey];
            const name = `${bridges.area[areaKey].name} ${channelName}`;

            let payload: object;
            let topic: string;

            if (type === 'light') {
              topic = `${mqttConfig.discovery_prefix}/${type}/a${areaKey}c${channelKey}/config`;
              if (lightmode === 'rgbw') {
                var uniqueid = name.toLowerCase().replace(/ /g, "_");
                payload = {
                  name: name,
                  unique_id: uniqueid,
                  state_topic: `${mqttConfig.topic_prefix}/${uniqueid}`,
                  command_topic: `${mqttConfig.topic_prefix}/${uniqueid}/set`,
                  schema: "json",
                  availablity_topic: mqttConfig.availability_topic,
                  brightness: true,
                  color_mode: true,
                  support_color_modes: ["rgbw"]
                };
                if (sendonce >= 1) {
                  publish_topic = false;
                }
                sendonce++;
              } else {
                payload = {
                  "~": `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}`,
                  name,
                  unique_id: name.toLowerCase().replace(/ /g, "_"),
                  cmd_t: "~/set",
                  stat_t: "~/state",
                  schema: "json",
                  brightness: true
                };
              }

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

            if (publish_topic) {
              console.log(`Sending payload: ${JSON.stringify(payload)} to topic: ${topic} `);
              client.publish(topic, JSON.stringify(payload), {
                qos: mqttConfig.qos,
                retain: mqttConfig.retain
              });
            }

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
      const mode = bridges.area[area].channel[channel].mdde;

      const sendMqttMessage = (data: object) => (err: Error) => {
        if (!err) {
          const mqttTopic = topic.replace('set', 'state');
          const payload = JSON.stringify(data);

          mqttClient.publish(mqttTopic, payload);
        }
      };

      const processLight = () => {

        const preparedynateforrgbw = (r: number, green: number, b: number, w: number,brightness:number) => {
          //assume that 
        }
        const { brightness: brightness, state: state, color: color } = JSON.parse(message.toString());
        var r, g, b, w, temp;
        if (!(color === undefined)) {
          //assume that all colors must exisit
          //todo check all colors
          temp = color['r'];
          if (!(temp === undefined)) {
            r = parseInt(temp);
          }

          temp = color['g'];
          if (!(temp === undefined)) {
            g = parseInt(temp);
          }

          temp = color['b'];
          if (!(temp === undefined)) {
            b = parseInt(temp);
          }

          temp = color['w'];
          if (!(temp === undefined)) {
            w = parseInt(temp);
          }
        }
        if (mode === 'rgbw') {
          if (state === "ON") {
            dbmanager.dbinsertorupdate((err) => {
              console.log("updated entry from mqtt with", areaNumber, channelNumber, state, r, g, b, w, brightness);
              const fade = bridges.area[area].channel[channel].fade * 10;

            }, areaNumber, channelNumber, "ON", r, g, b, w, brightness);
          } else if (state === "OFF") {
            dbmanager.dbinsertorupdate((err) => {
              console.log("updated entry from mqtt with", areaNumber, channelNumber, state);

            }, areaNumber, channelNumber, "ON", r, g, b, w, brightness);
          } else {
            //
            console.error('wrong state');
            return;
          }

        } else {

          const fade = bridges.area[area].channel[channel].fade * 10;

          const limitMinimumBrightness = (val: number) => val < 1 ? 1 : val;
          const channelLevel = !isNaN(brightness) ? limitMinimumBrightness(255 - brightness) : state === "ON" ? 1 : 255;

          const buffer = util.createBuffer([28, areaNumber, channelNumber - 1, 113, channelLevel, fade, 255]);

          dynaliteClient.write(Buffer.from(buffer), sendMqttMessage({ state, brightness }));
        }

      };
      const processChannelLevel = () => {
        const { channel_level: channelLevel } = JSON.parse(message.toString());
        let level = 255 - channelLevel;

        // level should be 1 - 255
        if (level === 0) {
          level = 1;
        }

        const buffer = util.createBuffer([28, areaNumber, channelNumber - 1, 113, level, 0, 255]);

        dynaliteClient.write(Buffer.from(buffer), sendMqttMessage({ channel_level: channelLevel }));
      };
      const processHvacSetpoint = () => {
        const { hvac_setpoint: hvacSetpoint } = JSON.parse(message.toString());
        const temperature = hvacSetpoint * 4;

        const buffer = util.createBuffer([28, areaNumber, 7, 74, 0, temperature, 255]);

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
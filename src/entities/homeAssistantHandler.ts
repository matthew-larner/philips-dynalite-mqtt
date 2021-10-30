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
              let mode = bridges.area[areaKey].channel[channelKey].mode; 
              topic = `${mqttConfig.discovery_prefix}/${type}/a${areaKey}c${channelKey}/config`;
              if (mode == "dimmer" || mode == "onoff") {
                payload = {
                  "~": `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}`,
                  name,
                  unique_id: name.toLowerCase().replace(/ /g, "_"),
                  cmd_t: "~/set",
                  stat_t: "~/state",
                  availability_topic: `${mqttConfig.topic_prefix}/available`,
                  schema: "json",
                  brightness: true
                };
              } else if (mode == "rgbw") {
                let name = `${bridges.area[areaKey].name} ${bridges.area[areaKey].channel[channelKey].name}`;
                let unique_id = name.toLowerCase().replace(/ /g, "_");
                payload = {
                  name: name,
                  unique_id: unique_id,
                  command_topic: `rgbw2mqtt/${unique_id}/set`,
                  state_topic: `rgbw2mqtt/${unique_id}`,
                  availability_topic: `${mqttConfig.topic_prefix}/available`,
                  schema: "json",
                  brightness: true,
                  color_mode: true,
                  supported_color_modes: ["rgbw"]
                };
              } 
              
            } else if (type === 'motion') {
              topic = `${mqttConfig.discovery_prefix}/binary_sensor/a${areaKey}c${channelKey}/config`;
              payload = {
                name,
                unique_id: name.toLowerCase().replace(/ /g, "_"),
                device_class: "motion",
                state_topic: `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}/state`,
                availability_topic: `${mqttConfig.topic_prefix}/available`
              };
            } else if (type === 'temperature') {
              topic = `${mqttConfig.discovery_prefix}/sensor/a${areaKey}c${channelKey}/config`;
              payload = {
                name,
                unique_id: name.toLowerCase().replace(/ /g, "_"),
                device_class: "temperature",
                state_topic: `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}/temp`,
                availability_topic: `${mqttConfig.topic_prefix}/available`,
                unit_of_measurement: "°C"
              };
            } else {
              // skip other types
              console.log('Home Assistant Discovery skipping type:', type);
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
  bridges,
  mqttConfig,
  db
}: Handler) =>
  (topic: string, message: Buffer) => {
    try {
      console.log("Topic:", topic, "Received message: ", message.toString().replace(/\s/g, ''));

      const [area, channel] = topic.split('/')[1].match(/\d+/g);
      const unique_id = bridges.area[area].channel[channel].name.toLowerCase().replace(/ /g, "_");
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
        let mode = bridges.area[area].channel[channel].mode;
        const { brightness, state } = JSON.parse(message.toString());
        const payload = JSON.parse(message.toString());
        
        const fade = bridges.area[area].channel[channel].fade * 10;

        const limitMinimumBrightness = (val: number) => val < 1 ? 1 : val;
        const channelLevel = !isNaN(brightness) ? limitMinimumBrightness(255 - brightness) : state === "ON" ? 1 : 255;

        
        if (mode == "onoff" || mode == "dimmer") {
          const buffer = util.createBuffer([28, areaNumber, channelNumber - 1, 113, channelLevel, fade, 255]);
          dynaliteClient.write(Buffer.from(buffer), sendMqttMessage({ state, brightness }));
        } else if (mode == "rgbw") {
          if (state == "ON") {
            let statement = "UPDATE lights SET state = 1";
            if (payload.red) {
              statement += `, red = ${payload.red}`
            }
            if (payload.blue) {
              statement += `, blue = ${payload.blue}`
            }
            if (payload.green) {
              statement += `, green = ${payload.green}`
            }
            if (payload.white) {
              statement += `, white = ${payload.white}`
            }
            if (payload.brightness) {
              statement += `, brightness = ${payload.brightness}`
            }
            db.run(statement);

            
          } else if (state == "OFF") {
            // TODO: write to DB
            db.run(`UPDATE lights SET state = 0 WHERE unique_id = ${unique_id}`);

            const buffer = util.createBuffer([28, areaNumber, channelNumber - 1, 113, channelLevel, 0, 255]);
            dynaliteClient.write(Buffer.from(buffer), sendMqttMessage({ state, brightness }));
          }
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
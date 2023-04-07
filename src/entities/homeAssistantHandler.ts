import * as mqtt from "mqtt";

import { Handler } from '../contracts';

import * as util from './utils';

import * as dbmanager from './dbmanager';


let mqttconfig_global: any;
export const startup = ({
  mqttConfig,
  bridges
}) =>
  (client: mqtt.MqttClient) => {
    const startupChannelPublish = () => {
      mqttconfig_global = mqttConfig;
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
                  "~": `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}`,
                  cmd_t: "~/set",
                  stat_t: "~/state",
                  schema: "json",
                  availability_topic: `${mqttConfig.availability_topic}`,
                  brightness: true,
                  color_mode: true,
                  supported_color_modes: ["rgbw"]
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
                  availability_topic: `${mqttConfig.availability_topic}`,
                  brightness: true
                };
              }

            } else if (type === 'motion') {
              topic = `${mqttConfig.discovery_prefix}/binary_sensor/a${areaKey}c${channelKey}/config`;
              payload = {
                name: `${bridges.area[areaKey].name} ${channelName}`,
                device_class: "motion",
                state_topic: `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}/state`,
                availability_topic: `${mqttConfig.availability_topic}`
              };
            } else if (type === 'temperature') {
              topic = `${mqttConfig.discovery_prefix}/sensor/a${areaKey}c${channelKey}/config`;
              payload = {
                name: `${bridges.area[areaKey].name} ${channelName}`,
                device_class: "temperature",
                state_topic: `${mqttConfig.topic_prefix}/a${areaKey}c${channelKey}/temp`,
                availability_topic: `${mqttConfig.availability_topic}`,
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
      const mode = bridges.area[area].channel[channel].mode;

      const sendMqttMessage = (data: object) => (err: Error) => {
        if (!err) {
          const mqttTopic = topic.replace('set', 'state');
          const payload = JSON.stringify(data);

          mqttClient.publish(mqttTopic, payload);
        }
      };

      const sendMqttMessageRgbw = (topic: string, row: any, _state: string) => {
        var msg: Object;
        if (_state === 'ON') {
          msg = {
            state: _state,
            color_mode: "rgbw",
            brightness: row.brightness,
            color: {
              r: row.red,
              g: row.green,
              b: row.blue,
              w: row.white
            }
          }
        } else {
          msg = {
            state: _state
          }
        }

        const payload = JSON.stringify(msg);
        console.log('send mqtt subscription topic ' + payload);
        mqttClient.publish(topic, payload);

      };

      const processLight = () => {

        const getchannellevel = (col: number, brightne: number) => {
          //assume that 
          var ch_level = 255 - Math.round((col * brightne / 255));
          ch_level = isNaN(ch_level) ? 255 : ch_level;
          return ((ch_level === 0) ? 1 : ch_level);

        }
        var { brightness: brightness, state: state, color: color } = JSON.parse(message.toString());
        console.log("received ", brightness, state, color);
        if (mode === 'rgbw') {

          var fade, channelLevel;
          const name = `${bridges.area[area].name} ${bridges.area[area].channel[channel].name}`;
          var uniqueid = name.toLowerCase().replace(/ /g, "_");
          let _topic = `${mqttconfig_global.topic_prefix}/a${areaNumber}c${channelNumber}/state`;

          //fetch area from db
          dbmanager.dbFetchArea(areaNumber, (row: any) => {
            //init the row with default if doesn't exist
            if (!row) {
              row = { state: "OFF", red: 0, green: 0, blue: 0, white: 0, brightness: 0 };
            }
            console.log("fetched area", row);

            var redchannel;

            switch (bridges.area[area].channel[channelNumber].channel) {
              case 'red':
                redchannel = channelNumber;
                break;
              case 'green':
                redchannel = channelNumber - 1;
                break;
              case 'blue':
                redchannel = channelNumber - 2;
                break;
              case 'white':
                redchannel = channelNumber - 3;
                break;
              case 'onoff':
                redchannel = channelNumber - 4;
                break;
              default:
                console.error('wrong channel number');
                return;
                break
            }

            if (state === "ON") {
              if ((color === undefined)) {
                color = {};
              }
              dbmanager.dbinsertorupdate((err) => {

                const delay = async (ms: number) => {
                  return new Promise(resolve => setTimeout(resolve, ms));
                }
                console.log("updated entry from mqtt with", areaNumber, channelNumber, state, color['r'], color['g'], color['b'], color['w'], brightness);

                //add onoff  
                fade = bridges.area[area].channel[redchannel + 4].fade * 10;
                channelLevel = 1;
                let temparr = [[28, areaNumber, redchannel + 4 - 1, 113, channelLevel, fade, 255]];

                //update the brightness
                if (!(brightness === undefined)) {
                  row.brightness = brightness;
                } else {
                  brightness = row.brightness;
                }

              //  console.log('brighness is',brightness,row.brightness);
                //add red

                if (!(color['r'] === undefined)) {
                  //update the red in the row
                  row.red = color['r'];
                }

                fade = bridges.area[area].channel[redchannel].fade * 10;
                channelLevel = getchannellevel(parseInt(row.red), brightness);
                temparr.push([28, areaNumber, redchannel + 0 - 1, 113, channelLevel, fade, 255]);

                //add green
                if (!(color['g'] === undefined)) {

                  //update the green in the row
                  row.green = color['g'];
                }

                fade = bridges.area[area].channel[redchannel + 1].fade * 10;
                channelLevel = getchannellevel(parseInt(row.green), brightness);
                temparr.push([28, areaNumber, redchannel + 1 - 1, 113, channelLevel, fade, 255]);

                //add blue
                if (!(color['b'] === undefined)) {
                  //update the blue in the row
                  row.blue = color['b'];
                }

                fade = bridges.area[area].channel[redchannel + 2].fade * 10;
                channelLevel = getchannellevel(parseInt(row.blue), brightness);
                temparr.push([28, areaNumber, redchannel + 2 - 1, 113, channelLevel, fade, 255]);

                //add white
                if (!(color['w'] === undefined)) {

                  //update the white in the row
                  row.white = color['w'];
                }

                fade = bridges.area[area].channel[redchannel + 3].fade * 10;
                channelLevel = getchannellevel(parseInt(row.white), brightness);
                temparr.push([28, areaNumber, redchannel + 3 - 1, 113, channelLevel, fade, 255]);

                var len = temparr.length;
                var i = 0;
                const recursivefunct = () => {

                  console.log('sending tcp packet ' + i);
                  var buffer = util.createBuffer(temparr[i]);
                  i++;
                  dynaliteClient.write(Buffer.from(buffer), (err) => {
                    if (err) {
                      console.error('error in sending tcp packet');
                      return
                    }
                    if (i >= len) {
                      console.log('no more packets');
                      //update the row to the current data
                      sendMqttMessageRgbw(_topic, row, state);
                      return;
                    }
                    recursivefunct();
                  });
                }

                recursivefunct();

              }, areaNumber, "ON", color['r'], color['g'], color['b'], color['w'], brightness);
            } else if (state === "OFF") {
              dbmanager.dbinsertorupdate((err) => {

                fade = bridges.area[area].channel[redchannel + 4].fade * 10;
                console.log("updated entry from mqtt with", areaNumber, channelNumber, state);
                channelLevel = 255;
                const buffer = util.createBuffer([28, areaNumber, redchannel + 4 - 1, 113, channelLevel, fade, 255]);
                dynaliteClient.write(Buffer.from(buffer), (err) => {
                  sendMqttMessageRgbw(_topic, null, state);
                });
              }, areaNumber, "OFF");
            }
          });



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
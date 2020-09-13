
import { Handler } from '../contracts';

import * as util from './utils';

export const commandsHandler = ({
  mqttClient,
  dynaliteClient,
  bridges,
  mqttConfig
}: Handler) =>
  (data: Buffer) => {
    console.log('Received dynalite message:', data);

    const firstDecimal = data[0];

    if (firstDecimal === 172) {
      const thirdDecimal = data[2];
      const area = data[7];
      const channel = thirdDecimal === 87 ? 0 : data[11]; // use channel 0 for temperature

      if (!bridges.area[area] || !bridges.area[area].channel[channel]) {
        console.log(`Dynalite ignored message with area: ${area} channel: ${channel}`);
        return;
      }

      const sendMqttMessage = (route: string) => (payload: string) => {
        const topic = `${mqttConfig.topic_prefix}/a${area}c${channel}/${route}`;

        mqttClient.publish(topic, payload);
      };
      const sendMqttStateMessage = sendMqttMessage('state');
      const sendMqttTemperatureMessage = sendMqttMessage('temp');

      const processLightAndMotionMessage = (code: number) => {
        const { type } = bridges.area[area].channel[channel];
        const createPayloadByType = (value: string) => ({
          light: JSON.stringify({ state: value }),
          motion: value
        });

        if (code === 1) {
          sendMqttStateMessage(createPayloadByType('ON')[type]);
        } else if (code === 4) {
          sendMqttStateMessage(createPayloadByType('OFF')[type]);
        } else if (code === 0) {
          const buffer = util.createBuffer([28, area, channel - 1, 97, 0, 0, 255]);

          dynaliteClient.write(Buffer.from(buffer));
        } else {
          console.log('Dynalite ignored message with 14th character decimal:', code);
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

        sendMqttStateMessage(JSON.stringify(payload));
      };
      const processTemperature = (x: number, y: number) => {
        const temp = (Math.round(parseFloat(`${x}.${y}`) * 10) / 10).toString();
        sendMqttTemperatureMessage(temp);
      }
      const processHvac = (data: string) => {
        sendMqttStateMessage(data);
      };
      const processChannelLevel = (data: string) => {
        sendMqttStateMessage(data);
      };

      if (thirdDecimal === 17) {
        processLightAndMotionMessage(data[13]);
      } else if (thirdDecimal === 35) {
        processChannelFeedbackMessage(data[14]);
      } else if (thirdDecimal === 87) {
        processTemperature(data[10], data[11]);
      } else if (thirdDecimal === 86) {
        processHvac(data[10].toString());
      } else if (thirdDecimal === 16) {
        processChannelLevel(data[12].toString());
      } else {
        console.log('Dynalite ignored message 3rd character decimal:', thirdDecimal);
      }
    } else {
      console.log('Dynalite ignored message 1st character with:', firstDecimal);
    }
  }
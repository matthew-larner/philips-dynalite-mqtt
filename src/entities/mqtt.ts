import * as mqtt from 'mqtt';

import {
	IClientOptions,
} from 'mqtt';

const connect = (config: any, onConnected: (client: mqtt.MqttClient) => void) => {
  if(!config.availability_topic){
    config.availability_topic='dynalite/available';
    console.warn('availability_topic is empty')
  }
  const client = mqtt.connect(`mqtt://${config.username}:${config.password}@${config.broker}:${config.port}`,{
    will: {
      topic: config.availability_topic,
      payload: 'offline',
      qos: 1,
      retain: true
    }
  }
);

  client.on('error', (err) => {
    console.log(`Mqtt error: ${err.message}`);
  });

  client.on('connect', () => {
    console.log('Connected to mqtt');

    onConnected(client);
  });

  client.on('close', () => {
    console.log('Mqtt connection closed');
  });

  const onMessage = (callback: mqtt.OnMessageCallback) => {
    client.on('message', callback);
  };

  const publish = (topic: string, payload: string) => {
    console.log(`Sending payload: ${payload} to topic: ${topic}`);
    client.publish(topic, payload, {
      qos: config.qos,
      retain: config.retain
    });
  };

  return {
    onMessage,
    publish
  };
};

export default connect;
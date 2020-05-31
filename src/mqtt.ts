import * as mqtt from 'mqtt';

const connect = (config, onConnected) => {

  const client = mqtt.connect(`mqtt://${config.broker}:${config.port}`);

  client.on('error', (err) => {
    console.log(`Mqtt error: ${err}`);
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
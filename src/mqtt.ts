import * as mqtt from 'mqtt';

const connect = (config, onConnected, onMessage) => {

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

  client.on('message', onMessage);

  return client;
};

export default connect;
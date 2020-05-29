import * as net from 'net';

const connect = (host: string, port: number) => {
  const client = new net.Socket();

  client.connect(port, host, () => {
    console.log('Connected to dynalite');
  });

  client.on('data', (data) => {
    console.log('Received: ' + data, JSON.stringify(data))
    // client.destroy(); // kill client after server's response
  });

  client.on('close', () => {
    console.log('Connection closed');
  });
}

export default connect;
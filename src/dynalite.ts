import * as net from 'net';

const connect = (host: string, port: number, onReceiveData: (data: Buffer) => void) => {
  const client = new net.Socket();

  client.connect(port, host, () => {
    console.log('Connected to dynalite');
  });

  client.on('data', onReceiveData);
  // client.on('data', (data) => {
  //   console.log('Received: ' + data.byteLength as any, data.toString('hex', 11, 12), JSON.stringify(data))
  //   // client.destroy(); // kill client after server's response
  // });

  client.on('close', () => {
    console.log('Dynalite connection closed');

    client.setTimeout(5000, () => {
      client.connect(port, host, () => {
        console.log('Connected to dynalite');
      });
    });
  });

  client.on('error', (err) => {
    console.log(`Dynalite error: ${err}`);
  });

  return client;
}

export default connect;
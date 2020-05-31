import * as net from 'net';

const connect = (host: string, port: number) => {
  const client = new net.Socket();

  client.connect(port, host, () => {
    console.log('Connected to dynalite');
  });

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

  const onMessage = (callback: (data: Buffer) => void) => {
    client.on('data', callback);
  };

  const write = (data: Buffer, cb?: (error?: Error) => void) => {
    console.log("TCP command to be sent:", data);
    client.write(data, cb);
  }

  return {
    onMessage,
    write
  };
}

export default connect;
import * as net from 'net';

const connect = (host: string, port: number, reconnectSeconds: number = 15) => {
  const client = new net.Socket();

  client.on('connect', () => {
    console.log('Connected to dynalite');
  });

  client.on('close', () => {
    console.log('Dynalite connection closed');

    setTimeout(() => {
      client.connect(port, host);
    }, reconnectSeconds * 1000);
  });

  client.on('error', (err) => {
    console.log(`Dynalite error: ${err.message}`);
  });

  client.connect(port, host);

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
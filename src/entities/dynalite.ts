import * as net from 'net';

const connect = (host: string, port: number, reconnectSeconds: number = 15, idleSeconds: number = 60) => {
  const client = new net.Socket();
  let timedOut = false;

  client.on('connect', () => {
    console.log('Connected to dynalite');

    client.setTimeout(idleSeconds * 1000);
  });

  client.on('close', () => {
    console.log('Dynalite connection closed');

    if (timedOut) {
      client.connect(port, host);
      timedOut = false;

      return;
    }

    setTimeout(() => {
      client.connect(port, host);
    }, reconnectSeconds * 1000);
  });

  client.on('error', (err) => {
    console.log(`Dynalite error: ${err.message}`);
  });

  client.on('timeout', () => {
    console.log(`No TCP communication detected in the last ${idleSeconds} seconds. Force reconnecting...`);
    timedOut = true;
    client.end();
  });

  client.connect(port, host);

  const onMessage = (callback: (data: Buffer) => void) => {
    client.on('data', callback);
  };

  const write = (data: Buffer, cb?: (error?: Error) => void) => {
    console.log("TCP command to be sent:", data);
    client.write(data, (err) => {
      if (err) {
        console.log(`Sending message to dynalite failed: ${err.message}`);
      }
      cb();
    });
  };

  return {
    onMessage,
    write
  };
}

export default connect;
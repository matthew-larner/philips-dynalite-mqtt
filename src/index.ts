import * as YAML from 'yaml';
import * as fs from 'fs'

import server from './server';
import mqtt from './mqtt';
import dynalite from './dynalite';
import * as util from './utils';

(async (): Promise<void> => {
  try {
    // Get and parse configuration
    const config = YAML.parse(fs.readFileSync('./configuration.yml', 'utf8'));
    process.env = {
      ...process.env,
      ...config
    }

    const appPort = parseInt(process.env.PORT) || 8080;
    const {
      mqtt: mqttConfig,
      dynalite: { bridges: [bridges] }
    } = config;

    // Provision service
    server(appPort);
    mqtt(mqttConfig, bridges);
    dynalite(bridges.host, bridges.port);

    // const test = '28,10,1,128,255,0,255'.split(',')
    //   .map(item => util.decimalToHex(parseInt(item)))
    //   .join(",");
    // console.log(test)
    // util.getChecksum(test);

  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
})();

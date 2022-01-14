import * as YAML from 'yaml';
import * as fs from 'fs';

import mqtt from './entities/mqtt';
import dynalite from './entities/dynalite';
import * as homeAssistantHandler from './entities/homeAssistantHandler';
import * as dynaliteHander from './entities/dynaliteHandler';
import * as dbmanager from './entities/dbmanager';

try {
  // Get and parse configuration
  const config = YAML.parse(fs.readFileSync('./config/configuration.yml', 'utf8'));
  const {
    mqtt: mqttConfig,
    dynalite: { bridges: [bridges] }
  } = config;
  dbmanager.dbinit(bridges);
  const mqttClient = mqtt(mqttConfig, homeAssistantHandler.startup({ mqttConfig, bridges }));
  const dynaliteClient = dynalite(bridges.host, bridges.port, bridges.reconnect_time, bridges.auto_reconnect_time);

  mqttClient.onMessage(homeAssistantHandler.commandsHandler({ mqttClient, dynaliteClient, bridges }));
  dynaliteClient.onMessage(dynaliteHander.commandsHandler({ mqttClient, dynaliteClient, bridges, mqttConfig }));

} catch (error) {
  console.error(error.message);
  console.log('closing !!!');
  dbmanager.dbclose();
  process.exit(1);
}

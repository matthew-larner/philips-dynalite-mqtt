import * as YAML from 'yaml';
import * as fs from 'fs';

import mqtt from './entities/mqtt';
import dynalite from './entities/dynalite';
import * as homeAssistantHandler from './entities/homeAssistantHandler';
import * as dynaliteHander from './entities/dynaliteHandler';

try {
  // Get and parse configuration
  const config = YAML.parse(fs.readFileSync('./config/configuration.yml', 'utf8'));
  console.log(config);
  const {
    mqtt: mqttConfig,
    dynalite: { bridges: [bridges] }
  } = config;

  var sqlite3 = require('sqlite3').verbose();
  var db = new sqlite3.Database('./data/lights.db');

  db.serialize(function() {

    db.run("CREATE TABLE IF NOT EXISTS lights (unique_id TEXT, name TEXT, state INTEGER, red TEXT, green TEXT, blue TEXT, white TEXT, brightness TEXT)");

    console.log(config.dynalite)
  });

  db.close();

  // const mqttClient = mqtt(mqttConfig, homeAssistantHandler.startup({ mqttConfig, bridges }));
  // const dynaliteClient = dynalite(bridges.host, bridges.port, bridges.reconnect_time, bridges.auto_reconnect_time);

  // mqttClient.onMessage(homeAssistantHandler.commandsHandler({ mqttClient, dynaliteClient, bridges }));
  // dynaliteClient.onMessage(dynaliteHander.commandsHandler({ mqttClient, dynaliteClient, bridges, mqttConfig }));

} catch (error) {
  console.error(error.message);
  process.exit(1);
}

import * as mqtt from 'mqtt';

const connect = (config: any, bridges: any) => {

  const client = mqtt.connect(`mqtt://${config.broker}:${config.port}`);

  client.on('error', (err) => {
    console.log(`Encountered error: ${err}`);
  })

  client.on('connect', () => {

    // subscribe to topic
    client.subscribe(config.topic_prefix, (err) => {
      if (err) {
        console.log(`Cannot subscribe to topic ${config.topic_prefix}: ${err}`)
      }
    });

    if (config.discovery) {
      const areaKeys = Object.keys(bridges.area);
      areaKeys.map(areaKey => {
        const channelKeys = Object.keys(bridges.area[areaKey].channel);
        channelKeys.map(channelKey => {
          const { type, name: channelName } = bridges.area[areaKey].channel[channelKey];
          const topic = `${config.topic_prefix}/${type}/${areaKey}/${channelKey}`;
          const name = `${bridges.area[areaKey].name}/${channelName}`;
          const payload = {
            "~": topic,
            name,
            unique_id: name.toLowerCase().replace(/ /g, "_"),
            cmd_t: "~/set",
            stat_t: "~/state",
            schema: "json",
            brightness: true
          }
          client.publish(config.topic_prefix, JSON.stringify(payload), {
            qos: config.qos,
            retain: config.retain
          });
        });
      })
    }
  });

  client.on('message', (topic, message) => {
    console.log(topic, message.toString());
    client.end();
  });

  return client;
};

export default connect;
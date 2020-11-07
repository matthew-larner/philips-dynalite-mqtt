# Philips Dynalite MQTT
A docker container to convert Philips Dynalite RS485 commands to MQTT. This container can be run in docker and connects to MQTT to communicate with Home Assistant. This project has no affiliation with Philips/Dynalite or Home Assistant. This is currently in beta. Use at your own risk.

## Setup Steps
1. Create a [MQTT server](https://hub.docker.com/_/eclipse-mosquitto)
2. Setup config file `configuration.yml` in `/config` directory (example below)
3. Setup docker compose file (example below)
4. Enable Home Assistant MQTT discovery if integrating with Home Assistant (optional): https://www.home-assistant.io/docs/mqtt/discovery/
5. Run the app by running `docker-compose up --build`

## Example Docker Compose File
```
version: '3'
services:
  dynalite:
    container_name: dynalite
    image: matthewlarner/philips-dynalite-mqtt:latest
    volumes:
      - ./config:/usr/src/app/config
    environment:
      - TZ=Australia/Sydney
    restart: always
```

## Example Config
```
# MQTT Settings
mqtt:
  broker: 192.168.1.102
  port: 1883
  qos: 2
  retain: true
  discovery: true
  discovery_prefix: homeassistant
  topic_prefix: dynalite

# Dynalite area config
dynalite:
  bridges:
    - host: 192.168.20.201
      port: 50000
      area:
        '1':
          name: Master Bedroom
          channel:       
            '0':
              name: Temperature
              type: temperature
            '1':
              name: Ensuite
              type: light
              brightness: true
              fade: 0.0
            '2':
              name: Bedhead
              type: light
              brightness: true
              fade: 2.0
            '3':
              name: Downlights
              type: light
              brightness: true
              fade: 2.0
            '4':
              name: Motion
              type: motion
        '2':
          name: Living Room
          channel:
            '1':
              name: Downlights
              type: light
              brightness: true
              fade: 2.0
            '2':
              name: Dining Table
              type: light
              brightness: true
              fade: 2.0
        '101':
          name: Aircon 1
          channel:
            '0':
              name: Target Temperature
              type: channel_level
            '1':
              name: On/Off
              type: channel_level
            '2':
              name: HVAC Mode
              type: channel_level
            '3':
              name: Fan Mode
              type: channel_level
            '4':
              name: Zone 1 Damper
              type: channel_level
            '5':
              name: Zone 2 Damper
              type: channel_level
```

**Where:**
- `type` is either: `temperature` (antumbra temperature reading), `light` (a light), `channel_level` (a channel level)
- `brghtness`: Allow brightness adjustment. `true` or `false`. Can be used with type=light only
- `fade`: fade time in seconds. Can be used with type=light only

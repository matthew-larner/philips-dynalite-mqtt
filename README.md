# Philips Dynalite MQTT
A docker container to convert Philips Dynalite RS485 commands to MQTT. This container can be run in docker and connects to MQTT to communicate with Home Assistant. This project has no affiliation with Philips/Dynalite.

## Setup Steps
1. Create a [MQTT server](https://hub.docker.com/_/eclipse-mosquitto)
2. Run the app by running `docker-compose up --build`
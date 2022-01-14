#! /bin/sh

#testing subrcription for rgbw state off
mosquitto_pub -h 127.0.0.1 -t dynalite/a3c1/set -m '{"state":"OFF"}'

#testing subrcription for rgbw state ON
mosquitto_pub -h 127.0.0.1 -t dynalite/a3c1/set -m '{"state":"ON","brightness":156}'

#testing update rgbw

mosquitto_pub -h 127.0.0.1 -t dynalite/a3c1/set -m '{"state":"ON","brightness":156,"color":{"r":255,"g":96,"b":215,"w":255}}'
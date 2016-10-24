#!/bin/bash

/node_modules/.bin/babel-node /crossdock/src/http_server.js &
/node_modules/.bin/babel-node /crossdock/src/tchannel_server.js &

sleep 10
/node_modules/.bin/babel-node /crossdock/src/healthcheck_server.js &

sleep infinity

#!/bin/bash

set -x

/node_modules/.bin/babel-node /crossdock/src/http_server.js &
/node_modules/.bin/babel-node /crossdock/src/tchannel_server.js &

# unfortunately, we do not check that the above two servers are ready
# before starting the healthcheck handler, so give them some time.
sleep 20

/node_modules/.bin/babel-node /crossdock/src/healthcheck_server.js &

sleep infinity

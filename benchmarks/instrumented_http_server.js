// Copyright (c) 2016 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed under the License
// is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied. See the License for the specific language governing permissions and limitations under
// the License.

var express  = require('express');
var ConstSampler = require('./dist/src/samplers/const_sampler.js').default;
var InMemoryReporter = require('./dist/src/reporters/in_memory_reporter.js').default;
var request = require('request');
var Tracer = require('./dist/src/tracer.js').default;

function HTTPServer(serverName, port, downstream) {
    if (!(this instanceof HTTPServer)) {
        return new HTTPServer(serverName, port, downstream);
    }

    var self = this;

    this._downstream = downstream || [];
    this._serverName = serverName;
    this._server = express();
    this._port = port;
    this._server.get('/', function(req, res) {
        self.handleRequest(res);
    });
    this._server.listen(this._port, function() {
        console.log('started', self._serverName, 'on port', self._port);
    });
    this._tracer = new Tracer(
        this._serverName,
        new InMemoryReporter(),
        new ConstSampler(true)
    );
}

HTTPServer.prototype.callDownstreamServers =
function callDownstreamServers(parentSpan, callback) {
    for (var i = 0; i < this._downstream.length; i++) {
        var hostPort = this._downstream[i];
        var clientSpan = this._tracer.startSpan({
            operationName: 'client-' + this._clientName,
            childOf: parentSpan.context()
        });

        function bindSpan(span) {
            console.log('calling downstream', hostPort);
            request.get('http://' + hostPort + '/', function(err, response) {
                if (err) {
                    console.log('err', err);
                    console.log('call to downstream failed: ' + hostPort);
                    return;
                }

                span.finish();
            });
        }
        bindSpan(clientSpan);
    }

    if (callback) {
        callback();
    }
};

HTTPServer.prototype.handleRequest =
function handleRequest(res) {
    var self = this;
    var serverSpan = this._tracer.startSpan({
        operationName: 'server-' + this._serverName,
    });

    this.callDownstreamServers(serverSpan, function() {
        serverSpan.finish();
        console.log('server responding', self._serverName);
        res.send('ok');
    });
};

module.exports = HTTPServer;

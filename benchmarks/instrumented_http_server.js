// Copyright (c) 2016 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

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

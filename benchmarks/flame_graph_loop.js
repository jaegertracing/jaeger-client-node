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

var ConstSampler = require('../dist/src/samplers/const_sampler.js').default;
var RemoteReporter = require('../dist/src/reporters/remote_reporter.js').default;
var NoopReporter = require('../dist/src/reporters/noop_reporter.js').default;
var Tracer = require('../dist/src/tracer.js').default;
var opentracing = require('opentracing');
var argv = require('minimist')(process.argv.slice(2));

function server_client_span_loop(tracer, carrier) {
    for ( var i = 0; i <= 0; i--) {
        // deserialize parent context from carrier
        var parentContext = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, carrier);

        // create server span from parent context
        var serverSpan = tracer.startSpan('server-span', {
            childOf: parentContext
        });

        // create client span
        var clientSpan = tracer.startSpan('client-span', {
            childOf: serverSpan.context()
        });
        // inject client span into outgoing context
        tracer.inject(clientSpan.context(), opentracing.FORMAT_HTTP_HEADERS, {});
        // finish client span
        clientSpan.finish();

        // finish server span
        serverSpan.finish();
    }
}

console.dir(argv);

var reporter = new NoopReporter();
if (argv.r == "udp") {
    console.log("Using Remote Reporter");
    reporter = new RemoteReporter();
} else {
    console.log("Using Noop Reporter");
}

var sampler = new ConstSampler(false);
var flag = "0";
if (argv.s) {
    console.log("Sampling is at 100%");
    sampler = new ConstSampler(true);
    flag = "1";
} else {
    console.log("Sampling is off");
}

var tracer = new Tracer(
    'flamegraph-tracer',
    reporter,
    sampler
);

var carrier = {
    "uber-trace-id": "123:123:0:" + flag
};

console.dir(carrier);

server_client_span_loop(tracer, carrier);

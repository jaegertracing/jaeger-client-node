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

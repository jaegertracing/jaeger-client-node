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

var _ = require('lodash');
var Benchmark = require('benchmark');
var benchmarks = require('beautify-benchmark');
var ConstSampler = require('../dist/src/samplers/const_sampler.js').default;
var ProbabilisticSampler = require('../dist/src/samplers/probabilistic_sampler.js').default;
var constants = require('../dist/src/constants.js');
var InMemoryReporter = require('../dist/src/reporters/in_memory_reporter.js').default;
var SpanContext = require('../dist/src/span_context.js').default;
var Tracer = require('../dist/src/tracer.js').default;
var opentracing = require('opentracing');


function benchmarkCoreFlows() {
    console.log('Beginning Main Request Flows...');

    var constTracer = new Tracer('const-tracer', new InMemoryReporter(), new ConstSampler(true));
    var span = constTracer.startSpan('op-name');

    var httpCarrier = {};
    constTracer.inject(span.context(), opentracing.FORMAT_HTTP_HEADERS, httpCarrier);

    var textCarrier = {};
    constTracer.inject(span.context(), opentracing.FORMAT_TEXT_MAP, textCarrier);

    var probabilisticTracer = new Tracer('probabilistic-tracer', new InMemoryReporter(), new ProbabilisticSampler(0.01));
    var params = [
        {'format': opentracing.FORMAT_HTTP_HEADERS, 'tracer': constTracer, 'carrier': httpCarrier, description: ' with const tracer and http carrier'},
        {'format': opentracing.FORMAT_TEXT_MAP, 'tracer': constTracer, 'carrier': textCarrier, description: ' with const tracer and text carrier'},
        {'format': opentracing.FORMAT_HTTP_HEADERS, 'tracer': probabilisticTracer, 'carrier': httpCarrier, description: ' with probabilistic tracer and http carrier'},
        {'format': opentracing.FORMAT_TEXT_MAP, 'tracer': probabilisticTracer, 'carrier': textCarrier, description: ' with probabilistic tracer and text carrier'},
    ];

    function run(tracer, carrier, format, description) {
        var suite = new Benchmark.Suite(tracer, carrier)
            .add('Fundamental Request flow', function() {
                var context = tracer.extract(format, carrier);
                var options = {
                    'childOf': context,
                    'tags': {
                        'tag-key-one': 'tag-value-one',
                        'tag-key-two': 'tag-value-two'
                    }
                };
                var serverSpan = tracer.startSpan('server-span', options);
                var clientSpan = tracer.startSpan('client-span', {childOf: serverSpan.context()});
                var outgoingCarrier = {};
                tracer.inject(clientSpan.context(), format, outgoingCarrier);
                clientSpan.finish();
                serverSpan.finish();
            })
            .on('cycle', function(event) {
                benchmarks.add(event.target);
                event.target.name = event.target.name + description;
            })
            .on('complete', function() {
                benchmarks.log();
            })

            // run async
            .run({ 'async': false });
    }

    _.each(params, function(o) {
        run(o['tracer'], o['carrier'], o['format'], o['description']);
    });
}

exports.benchmarkCoreFlows = benchmarkCoreFlows;

if (require.main === module) {
    benchmarkCoreFlows();
}

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
var InMemoryReporter = require('../dist/src/reporters/in_memory_reporter.js').default;
var ProbabilisticSampler = require('../dist/src/samplers/probabilistic_sampler.js').default;
var SpanContext = require('../dist/src/span_context.js').default;
var Tracer = require('../dist/src/tracer.js').default;
var ThriftUtils = require('../dist/src/thrift.js').default;
var opentracing = require('opentracing');

function benchmarkSpan() {

    var constTracer = new Tracer('const-tracer', new InMemoryReporter(), new ConstSampler(true));
    var probabilisticTracer = new Tracer('probabilistic-tracer', new InMemoryReporter(), new ProbabilisticSampler(0.1));

    var params = [
        { 'tracer': constTracer, 'description': ' with constant tracer' },
        { 'tracer': probabilisticTracer, 'description': ' with probabilitic tracer' }
    ];

    function createSpanFactory(tracer) {
        return function() {
            var span = tracer.startSpan('op-name');
            span.setBaggageItem('key', 'value');
            return span;
        }
    }



    console.log('Beginning Span Benchmark...');
    function run(createSpan, description) {
        var span = createSpan();
        var suite = new Benchmark.Suite()
            .add('Span:setBaggageItem', function() {
                span.setBaggageItem('key', 'value');
            })
            .add('Span:getBaggageItem', function() {
                span.getBaggageItem('key');
            })
            .add('Span:setOperationName', function() {
                span.setOperationName('op-name');
            })
            .add('Span:finish', function() {
                span.finish();
                span._duration = undefined;
            })
            .add('Span:addTags', function() {
                span.addTags({
                    'keyOne': 'one',
                    'keyTwo': 'two',
                    'keyThree': 'three'
                });
            })
            .add('Span:setTag', function() {
                span.setTag('key', 'value');
            })
            .add('Span.spanToThrift', function() {
                Thrift.spanToThrift(span);
            })
            .add('Span.log', function() {
                span.log({
                    'event': 'event message',
                    'payload': '{key: value}'
                });
            })
            .on('cycle', function(event) {
                benchmarks.add(event.target);
                event.target.name = event.target.name + description;
                span = createSpan();
            })
            .on('complete', function() {
                benchmarks.log();
            })
            // run async
            .run({ 'async': false });
    }

    _.each(params, function(o) {
        run(createSpanFactory(o['tracer']), o['description']);
    });
}

exports.benchmarkSpan = benchmarkSpan;

if (require.main === module) {
    benchmarkSpan();
}

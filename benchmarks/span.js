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

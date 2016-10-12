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
var NoopReporter = require('../dist/src/reporters/noop_reporter.js').default;
var SpanContext = require('../dist/src/span_context.js').default;
var Tracer = require('../dist/src/tracer.js').default;

function benchmarkSpanContext() {
    console.log('Beginning Span Context Benchmark...');

    var tracer = new Tracer('const-tracer', new NoopReporter(), new ConstSampler(true));
    var span = tracer.startSpan('op-name');
    var context = span.context();

    function run() {
        var suite = new Benchmark.Suite()
            .add('SpanContext:fromString', function() {
                SpanContext.fromString('ffffffffffffffff:ffffffffffffffff:5:1');
            })
            .add('SpanContext:toString', function() {
                context.toString('ffffffffffffffff:ffffffffffffffff:5:1');
            })
            .on('cycle', function(event) {
                benchmarks.add(event.target);
            })
            .on('complete', function() {
                benchmarks.log();
            })
            // run async
            .run({ 'async': false });
    }

    run();
}

exports.benchmarkSpanContext = benchmarkSpanContext;

if (require.main === module) {
    benchmarkSpanContext();
}

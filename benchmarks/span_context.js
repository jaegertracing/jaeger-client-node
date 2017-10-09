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

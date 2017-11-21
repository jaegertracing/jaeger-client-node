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

module.exports = {
    initTracer: require('./dist/src/configuration.js').default.initTracer,

    SpanContext: require('./dist/src/span_context.js').default,
    Span:        require('./dist/src/span.js').default,
    Tracer:      require('./dist/src/tracer.js').default,

    ConstSampler:         require('./dist/src/samplers/const_sampler.js').default,
    ProbabilisticSampler: require('./dist/src/samplers/probabilistic_sampler.js').default,
    RateLimitingSampler:  require('./dist/src/samplers/ratelimiting_sampler.js').default,
    RemoteSampler:        require('./dist/src/samplers/remote_sampler.js').default,

    CompositeReporter: require('./dist/src/reporters/composite_reporter.js').default,
    InMemoryReporter:  require('./dist/src/reporters/in_memory_reporter.js').default,
    LoggingReporter:   require('./dist/src/reporters/logging_reporter.js').default,
    NoopReporter:      require('./dist/src/reporters/noop_reporter.js').default,
    RemoteReporter:    require('./dist/src/reporters/remote_reporter.js').default,

    TextMapCodec:         require('./dist/src/propagators/text_map_codec.js').default,
    ZipkinB3TextMapCodec: require('./dist/src/propagators/zipkin_b3_text_map_codec.js').default,

    TestUtils:      require('./dist/src/test_util.js').default,
    TChannelBridge: require('./dist/src/tchannel_bridge.js').default,
    opentracing:    require('opentracing')
};

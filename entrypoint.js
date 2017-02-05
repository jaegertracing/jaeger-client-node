// var Configuration = require('./dist/src/configuration.js').default;

// var SpanContext = require('./dist/src/span_context.js').default;
// var Span = require('./dist/src/span.js').default;
// var Tracer = require('./dist/src/tracer.js').default;

// var ConstSampler = require('./dist/src/samplers/const_sampler.js').default;
// var ProbabilisticSampler = require('./dist/src/samplers/probabilistic_sampler.js').default;
// var RateLimitingSampler = require('./dist/src/samplers/ratelimiting_sampler.js').default;
// var RemoteSampler = require('./dist/src/samplers/remote_sampler.js').default;

// var CompositeReporter = require('./dist/src/reporters/composite_reporter.js').default;
// var InMemoryReporter = require('./dist/src/reporters/in_memory_reporter.js').default;
// var LoggingReporter = require('./dist/src/reporters/logging_reporter.js').default;
// var NoopReporter = require('./dist/src/reporters/noop_reporter.js').default;
// var RemoteReporter = require('./dist/src/reporters/remote_reporter.js').default;

// var TestUtils = require('./dist/src/test_util.js').default;
// var TChannelBridge = require('./dist/src/tchannel_bridge.js').default;
// var opentracing = require('opentracing');

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

    TestUtils:      require('./dist/src/test_util.js').default,
    TChannelBridge: require('./dist/src/tchannel_bridge.js').default,
    opentracing:    require('opentracing')
};

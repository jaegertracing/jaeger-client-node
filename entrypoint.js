var initTracer = require('./dist/src/index.js').initTracer;
var ConstSampler = require('./dist/src/samplers/const_sampler.js').default;
var ProbabilisticSampler = require('./dist/src/samplers/probabilistic_sampler.js').default;
var RateLimitingSampler = require('./dist/src/samplers/ratelimiting_sampler.js').default;
var RemoteSampler = require('./dist/src/samplers/remote_sampler.js').default;
var CompositeReporter = require('./dist/src/reporters/composite_reporter.js').default;
var InMemoryReporter = require('./dist/src/reporters/in_memory_reporter.js').default;
var LoggingReporter = require('./dist/src/reporters/logging_reporter.js').default;
var NoopReporter = require('./dist/src/reporters/noop_reporter.js').default;
var RemoteReporter = require('./dist/src/reporters/remote_reporter.js').default;

module.exports = {
    initTracer: initTracer,
    ConstSampler: ConstSampler,
    ProbabilisticSampler: ProbabilisticSampler,
    RateLimitingSampler: RateLimitingSampler,
    RemoteSampler: RemoteSampler,
    CompositeReporter: CompositeReporter,
    InMemoryReporter: InMemoryReporter,
    LoggingReporter: LoggingReporter,
    NoopReporter: NoopReporter,
    RemoteReporter: RemoteReporter
};

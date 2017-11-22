Changes by Version
==================

3.7.0 (2017-11-21)
------------------

- Add support for Zipkin B3 header propagation (#175)


3.6.0 (2017-11-13)
------------------

New features:

- Save baggage in span logs (#129)
- Add BaggageRestrictionManager and BaggageSetter (#142)
- Migrate to Apache license v2 (#159)
- Randomize rate limiter balance on initialization (#161)

Bug fixes:

- Trap exceptions from socket.send() (#137) - thanks @frankgreco
- Use ip tag instead of peer.ipv4 in process (#125)
- Log only span context (#153)
- Fix buffer size counting bug and add logging to UDP sender (#151)


3.5.3 (2017-04-24)
------------------

- Fix SamplingStrategyResponse strategyType (#110)


3.5.2 (2017-03-29)
------------------

- Protect from exceptions in decodeURIComponent (#105)
- Do not url-encode span context (#105)


3.5.1 (2017-03-07)
------------------

- Fix bug where leaky bucket never fills up when creditsPerSecond < itemCost (#104)


3.5.0 (2017-03-06)
------------------

- Remove dependency on 'request' module, use 'http' instead (https://github.com/uber/jaeger-client-node/pull/103)


3.4.0 (2017-02-20)
------------------

- Allow tags/logs with 'object' values and convert them to JSON (#102)


3.3.1 (2017-02-13)
------------------

- Add TestUtils.getTags(span, ?keys)


3.3.0 (2017-02-09)
------------------

- Make Configuration accept MetricsFactory, not Metrics


3.2.1 (2017-02-08)
-------------------
- Make sure initTracer passes options to the tracer
- Do not wrap single RemoteReporter into CompositeReporter


3.2.0 (2017-02-04)
-------------------
- Remove the following dependencies
   -    `"deep-equal": "^1.0.1",`
   -    `"long": "^3.2.0",`
   -    `"js-yaml": "^3.6.1",`
   -    `"jsonschema": "^1.1.0",`
- Move `TestUtil.thriftSpansEqual` and `Util.combinations` functions under `tests/lib`
- Remove most methods from TestUtils because the same checks can be done via public API
- Remove `hasLogs` method that was not particularly useful in practice because it compared the timestamp
- Accept external timestamps in milliseconds since epoch (#94)
- Expose TChannelBridge.inject method (#93)


3.1.0 (2017-02-02)
-------------------
- Added support for end to end crossdock integration tests.
- Fixed bug where "peer.ipv4" tag was not being saved.
- Fixed bug where tracer tags were being reported twice.
- Updated sampler config to allow extra customization.

3.0.0 (2017-01-20)
-------------------
- Added re-sampling after setOperationName is called.  This supports
  adaptive sampling in the cases where a span is given an operation name
  after it has been created.

1.3.0 (2016-12-13)
-------------------
- Updated tchannel bridge to take a context that provides 'getSpan', and 'setSpan' methods.
- Added support for adaptive sampling.

1.2.0 (2016-11-15)
-------------------

- Tchannel bridge for handlers, and encoded channel requests.
- Crossdock tchannel testing.
- Added tests for reporters, samplers, and utils.
- TestUtils doesn't use lodash anymore.
- Opentracing now exposed through jaeger-client
- Fixed bugs involving headers that don't contain any tracer state.

1.1.0 (2016-11-07)
-------------------

- Exposed opentracing module from jaeger.
- Removed 'jaeger' object wrapper from config object.

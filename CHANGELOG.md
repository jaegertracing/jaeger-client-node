# Changes by Version

## 3.19.0 (2021-10-31)

* Simplify bundling udp_sender (#530) -- Thorsten Nadel
* Add sampling path for tracer sampler config (#532) (#533) -- 飞雪无情
* Bump opentracing from 0.14.4 to 0.14.5 (#487) -- dependabot
* Update uuid package to latest stable version (#516) -- Manuel Alejandro de Brito Fontes
* Allow configuring http client timeout (#465) -- Yuri Shkuro
* Report HTTP errors when flushing spans (#459) -- Espen Hovlandsdal
* Fix env parsing of falsy values (#462) -- Gerrit-K
* Stop testing with Node <v10; upgrade tchannel->4.x (#463) -- Yuri Shkuro
* Upgrade xorshift@^1.1.1 (#442) -- Oliver Salzburg

## 3.18.1 (2020-08-14)

* Always read thrift defs from `./` to better support bundling (#441) - Hendrik Liebau

## 3.18.0 (2020-04-21)

* Upgrade to opentracing-javascript 0.14 (#117) - Yuri Shkuro
* Add OpenTracing methods to get span and trace id (#425) - Sandes de Silva

## 3.17.2 (2020-02-07)

* README: Clarify that this library is not designed to work in the browser.

## 3.17.1 (2019-10-22)

* [bug fix] Do not apply adaptive sampler to child spans (#410) -- Yuri Shkuro
* Add toString to reporters (#403) -- Andrea Di Giorgi

## 3.17.0 (2019-09-23)

* Add option to support zipkin's shared span id between client and server spans (#399) -- Jonathan Monette
* Allow specifying 128bit trace IDs via Configuration (#397) -- Aleksei Androsov
* Add support for UDP over IPv6 (#396) -- Aleksei Androsov

## 3.16.0 (2019-09-09)

* Support 128bit traceIDs (#361) - thanks @PaulMiami
* Support delayed sampling (#380) - thanks @yurishkuro
* All spans of a trace share sampling state (#377) - thanks @tiffon and @yurishkuro

## 3.15.0 (2019-05-10)

* Avoid mutation of user's tags (#348) - Thanks @fapspirit
* Support false values for the B3 Sampled header (#346) - Thanks @sebnow
* Fix HTTP sender, consume response data to free up memory (#343) - Thanks @baldmaster
* Transform IP for int32 representation to dot representation (#340) - Thanks @Etienne-Carriere

## 3.14.4 (2019-01-24)

* Hard code version

## 3.14.3 (2019-01-24)

* Nothing

## 3.14.2 (2019-01-24)

* Actually fix issue where dist/src files were missing

## 3.14.1 (2019-01-24)

* Fixed issue where dist/src files were missing

## 3.14.0 (2019-01-24)

* Add setProcess method to LoggingReporter (#303) - thanks @isayme
* Change Zipkin Codec to Not Inject Missing Parent (#305) - thanks @adinunzio84
* Add missed contextKey option to initTracer (#308) - thanks @yepninja
* Allow overriding codec's default baggage prefix (#310) - thanks @artemruts
* Make zipkin codec use case insensetive headers (#309) - thanks @artemruts
* Fix Span.log to return `this` (#316) - thanks @doubret
* Support injecting and extracting into carriers without Object prototypes (#318) - thanks @ggoodman
* Support canonical env variables (#311) - thanks @yepninja
* Rename 'jaeger.hostname' tracer tag to 'hostname' (#333) - thanks @verma-varsha
* Use the ip and hostname tags if provided (#336) - thanks @ledor473
* Make TchannelBridge use semantic conventions when logging error to the span (#334) - thanks @verma-varsha

## 3.13.0 (2018-10-08)

* Support TLS in HTTP Sender (#294) - thanks [Ben Keith @keitwb](https://github.com/keitwb)
* Support ENV variables for configuration (#296) - thanks [Eundoo Song @eundoosong](https://github.com/eundoosong)

## 3.12.0 (2018-08-10)

* Rename `"throttler-update"` metric (#279) - thanks @yknx4
* Add HTTP Sender (#280) - thanks @keitwb

## 3.11.0 (2018-07-09)

* Add throttler (#246)
* Use throttler for rate limiting (#248)
* Make metrics consistent with Go/Java clients (#255) - thanks @eundoosong
* Pass logger/metrics option to remote sampler, reporter (#257) - thanks @eundoosong
* Update RateLimiter to scale credits on update (#264)
* Replace Coveralls by Codecov (#269) - thanks @eundoosong
* Add PrometheusMetricsFactory (#262) - thanks @eundoosong
* Upgrade flow to v0.75 (#272) - thanks @TLadd
* Pass object to prom-client metric to fix warning (#274) - thanks @eundoosong

## 3.10.0 (2018-03-02)

* Made tracing headers configurable (#217) - thanks @astub
* Add husky as a dev-dependency (#234)
* Require Node 6.x for building (#235)

## 3.9.1 (2018-02-26)

* Remove husky dependency as a temporary fix for #232

## 3.9.0 (2018-02-26)

* RemoteReporter.close() now ensures that the buffer is flushed before invoking the callback (#224, #226) - thanks @MarckK
  * Fix Possible race condition in UDPSender #214
  * Fix Support callback in udpSender.flush #157
  * Fix Change SenderResponse.err to be a message string #32
* Node 6.x is recommended for development
  * Add .nvmrc to tell husky precommit which Node version to use (#227)
* Export Configuration class (#221)
* Add engines field to package.json (#231)

## 3.8.0 (2018-01-24)

* Log error when Thrift conversion fails (#184)
* Throw error if serviceName is not provided (#192)
* Flush only if process is set (#195)
* Change default flush interval to 1sec (#196)

## 3.7.0 (2017-11-21)

* Add support for Zipkin B3 header propagation (#175)

## 3.6.0 (2017-11-13)

New features:

* Save baggage in span logs (#129)
* Add BaggageRestrictionManager and BaggageSetter (#142)
* Migrate to Apache license v2 (#159)
* Randomize rate limiter balance on initialization (#161)

Bug fixes:

* Trap exceptions from socket.send() (#137) - thanks @frankgreco
* Use ip tag instead of peer.ipv4 in process (#125)
* Log only span context (#153)
* Fix buffer size counting bug and add logging to UDP sender (#151)

## 3.5.3 (2017-04-24)

* Fix SamplingStrategyResponse strategyType (#110)

## 3.5.2 (2017-03-29)

* Protect from exceptions in decodeURIComponent (#105)
* Do not url-encode span context (#105)

## 3.5.1 (2017-03-07)

* Fix bug where leaky bucket never fills up when creditsPerSecond < itemCost (#104)

## 3.5.0 (2017-03-06)

* Remove dependency on 'request' module, use 'http' instead (https://github.com/uber/jaeger-client-node/pull/103)

## 3.4.0 (2017-02-20)

* Allow tags/logs with 'object' values and convert them to JSON (#102)

## 3.3.1 (2017-02-13)

* Add TestUtils.getTags(span, ?keys)

## 3.3.0 (2017-02-09)

* Make Configuration accept MetricsFactory, not Metrics

## 3.2.1 (2017-02-08)

* Make sure initTracer passes options to the tracer
* Do not wrap single RemoteReporter into CompositeReporter

## 3.2.0 (2017-02-04)

* Remove the following dependencies
  * `"deep-equal": "^1.0.1",`
  * `"long": "^3.2.0",`
  * `"js-yaml": "^3.6.1",`
  * `"jsonschema": "^1.1.0",`
* Move `TestUtil.thriftSpansEqual` and `Util.combinations` functions under `tests/lib`
* Remove most methods from TestUtils because the same checks can be done via public API
* Remove `hasLogs` method that was not particularly useful in practice because it compared the timestamp
* Accept external timestamps in milliseconds since epoch (#94)
* Expose TChannelBridge.inject method (#93)

## 3.1.0 (2017-02-02)

* Added support for end to end crossdock integration tests.
* Fixed bug where "peer.ipv4" tag was not being saved.
* Fixed bug where tracer tags were being reported twice.
* Updated sampler config to allow extra customization.

## 3.0.0 (2017-01-20)

* Added re-sampling after setOperationName is called. This supports adaptive sampling in the cases where a span is given an operation name after it has been created.

## 1.3.0 (2016-12-13)

* Updated tchannel bridge to take a context that provides 'getSpan', and 'setSpan' methods.
* Added support for adaptive sampling.

## 1.2.0 (2016-11-15)

* Tchannel bridge for handlers, and encoded channel requests.
* Crossdock tchannel testing.
* Added tests for reporters, samplers, and utils.
* TestUtils doesn't use lodash anymore.
* Opentracing now exposed through jaeger-client
* Fixed bugs involving headers that don't contain any tracer state.

## 1.1.0 (2016-11-07)

* Exposed opentracing module from jaeger.
* Removed 'jaeger' object wrapper from config object.

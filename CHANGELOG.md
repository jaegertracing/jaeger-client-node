sh --registry=https://registry.npmjs.org
Changes by Version
==================
3.0.1 (Unreleased)
-------------------

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

[![Build Status][ci-img]][ci] [![Coverage Status][cov-img]][cov] [![NPM Published Version][npm-img]][npm]

# Jaeger Bindings for Javascript OpenTracing API

This is a client side library that implements
[Javascript OpenTracing API](https://github.com/opentracing/opentracing-javascript/),
with Zipkin-compatible data model.

**This project is currently WIP and not ready for use. Do not use it until this notice goes away.**

## Contributing

Please see (CONTRIBUTING.md)[./CONTRIBUTING.md].

### Debug Traces (Forced Sampling)

#### Programmatically

The OpenTracing API defines a `sampling.priority` standard tag that
can be used to affect the sampling of a span and its children:

```javascript
span.setTag(opentracing_tags.SAMPLING_PRIORITY, 1);
```

#### Via HTTP Headers

Jaeger Tracer also understands a special HTTP Header `jaeger-debug-id`,
which can be set in the incoming request, e.g.

```sh
curl -H "jaeger-debug-id: some-correlation-id" http://myhost.com
```

When Jaeger sees this header in the request that otherwise has no
tracing context, it ensures that the new trace started for this
request will be sampled in the "debug" mode (meaning it should survive
all downsampling that might happen in the collection pipeline), and the 
root span will have a tag as if this statement was executed:

```javascript
span.setTag("jaeger-debug-id", "some-correlation-id");
```

This allows using Jaeger UI to find the trace by this tag.


  [ci-img]: https://travis-ci.org/uber/jaeger-client-node.svg?branch=master
  [cov-img]: https://coveralls.io/repos/github/uber/jaeger-client-node/badge.svg?branch=master
  [npm-img]: https://badge.fury.io/js/jaeger-client.svg
  [ci]: https://travis-ci.org/uber/jaeger-client-node
  [cov]: https://coveralls.io/github/uber/jaeger-client-$node?branch=master
  [npm]: https://www.npmjs.com/package/jaeger-client

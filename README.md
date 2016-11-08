[![Build Status][ci-img]][ci] [![Coverage Status][cov-img]][cov] [![NPM Published Version][npm-img]][npm]

# Jaeger Bindings for Javascript OpenTracing API

This is a client side library that implements
[Javascript OpenTracing API](https://github.com/opentracing/opentracing-javascript/),
with Zipkin-compatible data model.

**This project is currently WIP and not ready for use. Do not use it until this notice goes away.**

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md).

### TChannel Span Bridging

Because [tchannel-node](https://github.com/uber/tchannel-node) does not have instrumentation
for OpenTracing, Jaeger-Client exposes methods wrapping tchannel handlers, and encoded channels.
An encoded channel is a channel wrapped in either a thrift encoder `TChannelAsThrift`, 
or json encoder `TChannelAsJson`.  To wrap a server handler for thrift one can initialize
a tchannel bridge, and wrap there encoded handler function with `tracedHandler` decorator.

```javascript
    import { TChannelBridge } from 'jaeger-client';

    let bridge = new TChannelBridge(tracer);
    let server = new TChannel({ serviceName: 'server' });
    server.listen(4040, '127.0.0.1');
    let serverThriftChannel = TChannelAsThrift({
        channel: server,
        entryPoint: path.join(__dirname, 'thrift', 'echo.thrift') // file path to a thrift file
    });

    serverThriftChannel.register(server, 'Echo::echo', context, bridge.tracedHandler(
        (context, req, head, body, callback) => {
            // context will contain an 'openTracingSpan' field that stores the tracing span for the inbound request.
            // Your handler code goes here.
        }
    ));
```


Outbound calls can be made in two ways, shown below.

#### Using encoded channel to create a request and calling `request.send()`

```javascript
    import { TChannelBridge } from 'jaeger-client';

    let bridge = new TChannelBridge(tracer);
    // Create the toplevel client channel.
    let client = new TChannel();

    // Create the client subchannel that makes requests.
    let clientSubChannel = client.makeSubChannel({
        serviceName: 'server',
        peers: ['127.0.0.1:4040']
    });

    let encodedThriftChannel = TChannelAsThrift({
        channel: clientSubChannel,
        entryPoint: path.join(__dirname, 'thrift', 'echo.thrift') // file path to a thrift file
    });

    // wrap encodedThriftChannel in a tracing decorator
    let tracedChannel = bridge.tracedChannel(encodedThriftChannel);

    // The encodedThriftChannel's (also true for json encoded channels) request object can call 'send' directly.
    let req = tracedChannel.request({
        serviceName: 'server',
        context: context, // must be passed through from the service handler shown above
        headers: { cn: 'echo' }
    });

    // headers should contain your outgoing tchannel headers if any.
    // In this instance 'send' is being called on the request object, and not the channel.
    req.send('Echo::echo', headers, { value: 'some-string' });
```

#### Using top level channel to create a request and calling `encodedChannel.send(request)`

```javascript
    let tracedChannel = bridge.tracedChannel(encodedThriftChannel);

    // tracedChannel.channel refers to encodedThriftChannel's inner channel which
    // is clientSubChannel in this instance.
    let req = tracedChannel.channel.request({
        serviceName: 'server',
        headers: { cn: 'echo' },
        context: context, // must be passed through from the service handler shown above
        timeout: someTimeout,
    });
    // send() can be called directly on the tracing decorator
    tracedChannel.send(req, 'Echo::echo', o.headers, { value: 'some-string' }, clientCallback);
```

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

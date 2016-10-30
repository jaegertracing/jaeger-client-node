// @flow
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

import _ from 'lodash';
import {assert} from 'chai';
import * as constants from '../src/constants';
import ConstSampler from '../src/samplers/const_sampler';
import path from 'path';
import InMemoryReporter from '../src/reporters/in_memory_reporter';
import opentracing from 'opentracing';
import TestUtils from '../src/test_util.js';
import Tracer from '../src/tracer';
import TChannel from 'tchannel';
import TChannelBridge from '../src/tchannel_bridge.js';
import TChannelAsThrift from 'tchannel/as/thrift';
import TChannelAsJSON from 'tchannel/as/json';

describe ('test tchannel span bridge', () => {
    // BIG_TIMEOUT is useful for debugging purposes.
    let BIG_TIMEOUT = 15000000;
    let reporter = new InMemoryReporter();
    let tracer = new Tracer(
        'test-service',
        reporter,
        new ConstSampler(true)
    );
    let bridge = new TChannelBridge(tracer);

    let options = [
        { description: 'tchannelAsJson', channelEncoding: TChannelAsJSON, mode: 'req.send', as: 'json' },
        { description: 'tchannelAsJson', channelEncoding: TChannelAsJSON, mode: 'channel.send', as: 'json' },
        { description: 'tchannelAsThrift', channelEncoding: TChannelAsThrift, mode: 'req.send', as: 'thrift' },
        { description: 'tchannelAsThrift', channelEncoding: TChannelAsThrift, mode: 'channel.send', as: 'thrift' }
    ];

    _.each(options, (o) => {

        it (o.description + ' spans propagate through tchannel and preserve parent span properties', (done) => {
            let originalSpan = tracer.startSpan('futurama');
            originalSpan.setBaggageItem('leela', 'fry');
            let contextForOutgoingCall = { openTracingSpan: originalSpan };

            let server = new TChannel({
                serviceName: 'server',
                timeout: BIG_TIMEOUT,
                // force tracing on  in order to prove that overriding works
                trace: true,
                forceTrace: true
            });
            // Server calls client channel after it starts listening.
            server.listen(4040, '127.0.0.1', onServerListening);

            // Create the top level client channel.
            let client = new TChannel({
                // force tracing on  in order to prove that overriding works
                trace: true,
                forceTrace: true
            });

            // Create the client subchannel that makes requests.
            let clientSubChannel = client.makeSubChannel({
                serviceName: 'server',
                peers: ['127.0.0.1:4040']
            });

            // Wrap the subchannel in an encoding
            let encodedChannel = o.channelEncoding({
                channel: clientSubChannel,
                entryPoint: path.join(__dirname, 'thrift', 'echo.thrift') // ignored in json case
            });

            // register the server request function.
            let context = {};
            encodedChannel.register(server, 'Echo::echo', context, bridge.tracedHandler(handleServerReq));
            function handleServerReq(context, req, head, body, callback) {
                // headers should not contain $tracing$ prefixed keys, which should be the
                // only headers used for this test.
                assert.equal(Object.keys(head).length, 0);

                // assert that the serverSpan is a child of the original span
                assert.equal(originalSpan.context().traceIdStr, context.openTracingSpan.context().traceIdStr);
                callback(null, { ok: true, body: { value: 'some-string' }});
            }

            function onServerListening(err, res, arg2, arg3) {
                // Outgoing tchannel call is traced
                let tracedChannel = bridge.tracedChannel(encodedChannel);

                // headers are left empty in order to prove that tracedChannel populates them
                let emptyHeaders = {};

                let clientCallback = (err, res, headers, body) => {
                    assert.isNotOk(err);
                    assert.equal(reporter.spans.length, 2);

                    // the first span to be reported is the server span
                    let serverSpan = reporter.spans[0];
                    // the second span to be reported is the client span
                    let clientSpan = reporter.spans[1];

                    let serverSpanTags = {};
                    serverSpanTags[opentracing.Tags.PEER_SERVICE] = 'echo';
                    serverSpanTags[opentracing.Tags.SPAN_KIND] = opentracing.Tags.SPAN_KIND_RPC_SERVER;
                    serverSpanTags[opentracing.Tags.PEER_HOST_IPV4] = ((127 << 24) | 1);
                    serverSpanTags['as'] = o.as;
                    // TODO(oibe) the port for the client request ephemeral, and I don't know how to get it, or if I can.

                    let clientSpanTags = {};
                    clientSpanTags[opentracing.Tags.PEER_SERVICE] = 'server';
                    clientSpanTags[opentracing.Tags.SPAN_KIND] = opentracing.Tags.SPAN_KIND_RPC_CLIENT;

                    assert.isOk(TestUtils.hasTags(serverSpan, serverSpanTags));
                    assert.isOk(TestUtils.hasTags(clientSpan, clientSpanTags));

                    assert.equal(serverSpan.context().parentIdStr, clientSpan.context().spanIdStr);
                    assert.equal(serverSpan.context().traceIdStr, originalSpan.context().traceIdStr);
                    assert.equal(clientSpan.context().traceIdStr, originalSpan.context().traceIdStr);

                    reporter.clear();
                    server.close();
                    client.close();
                    done();
                }

                if (o.mode === 'req.send') {
                    let req = tracedChannel.request({
                        serviceName: 'server',
                        headers: { cn: 'echo' },
                        openTracingContext: contextForOutgoingCall,
                        timeout: BIG_TIMEOUT
                    });
                    req.send('Echo::echo', emptyHeaders, { value: 'some-string' }, clientCallback);
                } else if (o.mode === 'channel.send') {
                    let req = tracedChannel.channel.request({
                        serviceName: 'server',
                        headers: { cn: 'echo' },
                        openTracingContext: contextForOutgoingCall,
                        timeout: BIG_TIMEOUT
                    });
                    tracedChannel.send(req, 'Echo::echo', emptyHeaders, { value: 'some-string' }, clientCallback);
                }
            }
        }).timeout(BIG_TIMEOUT);
    });
});

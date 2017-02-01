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
import DefaultContext from '../src/default_context';
import path from 'path';
import InMemoryReporter from '../src/reporters/in_memory_reporter';
import opentracing from 'opentracing';
import TestUtils from '../src/test_util.js';
import Tracer from '../src/tracer';
import TChannel from 'tchannel';
import TChannelBridge from '../src/tchannel_bridge.js';
import TChannelAsThrift from 'tchannel/as/thrift';
import TChannelAsJSON from 'tchannel/as/json';
import Utils from '../src/util.js';

describe ('test tchannel span bridge', () => {
    // BIG_TIMEOUT is useful for debugging purposes.
    let BIG_TIMEOUT = 15000000;
    let reporter = new InMemoryReporter();
    let tracer = new Tracer(
        'test-service',
        reporter,
        new ConstSampler(true)
    );
    let bridge = new TChannelBridge(tracer, {
        contextFactory: () => { return new DefaultContext(); }
    });
    let originalSpan = tracer.startSpan('futurama');
    originalSpan.setBaggageItem('leela', 'fry');
    let ctx1 = new DefaultContext();
    ctx1.setSpan(originalSpan);

    let options = Utils.combinations({
            as: ['json', 'thrift'],
            mode: ['req.send', 'channel.send'],
            context: [ctx1, null],
            headers: [{}, null]
    });

    _.each(options, (o) => {
        o.description = `as=${o.as}|mode=${o.mode}`;
        o.channelEncoding = o.as === 'json' ? TChannelAsJSON: TChannelAsThrift;

        it (o.description + ' spans propagate through tchannel and preserve parent span properties', (done) => {
            let server = new TChannel({
                serviceName: 'server',
                timeout: BIG_TIMEOUT,
                // force tracing on in order to prove that overriding works
                trace: true,
                forceTrace: true
            });
            // Server calls client channel after it starts listening.
            server.listen(4040, '127.0.0.1', onServerListening);

            // Create the top level client channel.
            let client = new TChannel({
                // force tracing on in order to prove that overriding works
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

            let options: any = {};
            encodedChannel.register(server, 'Echo::echo', options, bridge.tracedHandler(handleServerReq));
            function handleServerReq(context, req, head, body, callback) {
                // headers should not contain $tracing$ prefixed keys, which should be the
                // only headers used for this test.
                assert.equal(Object.keys(head).length, 0);

                // assert that the serverSpan is a child of the original span, if context exists
                // assert that the serverSpan is NOT a child of the original span, if contexts is null
                assert.equal(originalSpan.context().traceIdStr === req.context.getSpan().context().traceIdStr, !!o.context);
                callback(null, { ok: true, body: { value: 'some-string' }});
            }

            function onServerListening(err, res, arg2, arg3) {
                // Outgoing tchannel call is traced
                let tracedChannel = bridge.tracedChannel(encodedChannel);

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
                    serverSpanTags['as'] = o.as;
                    // TODO(oibe) the port for the client request ephemeral, and I don't know how to get it, or if I can.

                    let clientSpanTags = {};
                    clientSpanTags[opentracing.Tags.PEER_SERVICE] = 'server';
                    clientSpanTags[opentracing.Tags.SPAN_KIND] = opentracing.Tags.SPAN_KIND_RPC_CLIENT;

                    assert.isOk(TestUtils.hasTags(serverSpan, serverSpanTags));
                    assert.isOk(TestUtils.hasTags(clientSpan, clientSpanTags));

                    assert.equal(serverSpan.context().parentIdStr, clientSpan.context().spanIdStr);
                    // If context exists then the following conditions are true
                    // else the following conditons are false
                    assert.equal(serverSpan.context().traceIdStr === originalSpan.context().traceIdStr, !!o.context);
                    assert.equal(clientSpan.context().traceIdStr === originalSpan.context().traceIdStr, !!o.context);

                    reporter.clear();
                    server.close();
                    client.close();
                    done();
                }

                if (o.mode === 'req.send') {
                    let req = tracedChannel.request({
                        serviceName: 'server',
                        headers: { cn: 'echo' },
                        context: o.context,
                        timeout: BIG_TIMEOUT
                    });
                    req.send('Echo::echo', o.headers, { value: 'some-string' }, clientCallback);
                } else if (o.mode === 'channel.send') {
                    let req = tracedChannel.channel.request({
                        serviceName: 'server',
                        headers: { cn: 'echo' },
                        context: o.context,
                        timeout: BIG_TIMEOUT
                    });
                    tracedChannel.send(req, 'Echo::echo', o.headers, { value: 'some-string' }, clientCallback);
                }
            }
        }).timeout(BIG_TIMEOUT);
    });
});

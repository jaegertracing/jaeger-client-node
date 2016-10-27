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
import Tracer from '../src/tracer';
import TChannel from 'tchannel';
import TChannelBridge from '../src/tchannel_bridge.js';
import TChannelAsThrift from 'tchannel/as/thrift';
import TChannelAsJSON from 'tchannel/as/json';

describe ('test tchannel span bridge', () => {
    // BIG_TIMEOUT is useful for debugging purposes.
    let BIG_TIMEOUT = 15000000;
    let tracer = new Tracer(
        'test-service',
        new InMemoryReporter(),
        new ConstSampler(true)
    );
    let bridge = new TChannelBridge(tracer);

    let options = [
        { description: 'tchannelAsJson', channelEncoding: TChannelAsJSON },
        { description: 'tchannelAsThrift', channelEncoding: TChannelAsThrift }
    ];

    _.each(options, (o) => {

        it (o.description + ' spans propagate through tchannel and preserve parent span properties', (done) => {
            let originalSpan = tracer.startSpan('futurama');
            originalSpan.setBaggageItem('leela', 'fry');
            let contextForOutgoingCall = { span: originalSpan };

            let server = new TChannel({
                serviceName: 'server',
                // force tracing on  in order to prove that overriding works
                trace: true,
                forceTrace: true
            });
            // Server calls client channel after it starts listening.
            server.listen(4040, '127.0.0.1', onServerListening);

            // Create the toplevel client channel.
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
                // assert that context is populated with new server span
                assert.equal(originalSpan.context().traceIdStr, context.span.context().traceIdStr);

                // assert that headers match the original span
                let headers = head[constants.TCHANNEL_TRACING_PREFIX + constants.TRACER_STATE_HEADER_NAME].split(':');
                let traceId = headers[0];
                let spanId = headers[1];
                let flags = parseInt(headers[3]);

                assert.equal(originalSpan.context().traceIdStr, traceId);
                assert.equal(originalSpan.context().spanIdStr, spanId);
                assert.equal(originalSpan.context().parentId, null);
                assert.equal(originalSpan.context().flags, flags);
                server.close();
                client.close();
                done();
            }

            function onServerListening() {
                // Outgoing tchannel call is traced
                let tracedChannel = bridge.tracedChannel(encodedChannel, contextForOutgoingCall);
                let req = tracedChannel.request({
                    serviceName: 'server',
                    headers: { cn: 'echo' },
                    timeout: BIG_TIMEOUT
                });

                // headers are left empty in order to prove that tracedChannel populates them
                let emptyHeaders = {};
                req.send('Echo::echo', emptyHeaders, { value: 'some-string' });
            }
        }).timeout(BIG_TIMEOUT);
    });
});

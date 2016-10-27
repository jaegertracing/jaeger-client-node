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
import {assert, expect} from 'chai';
import * as constants from '../src/constants';
import ConstSampler from '../src/samplers/const_sampler';
import deepEqual from 'deep-equal';
import fs from 'fs';
import path from 'path';
import InMemoryReporter from '../src/reporters/in_memory_reporter';
import opentracing from 'opentracing';
import TestUtils from '../src/test_util';
import Tracer from '../src/tracer';
import TChannel from 'tchannel';
import TChannelThrift from 'tchannel/as/thrift';
import TChannelBridge from '../src/tchannel_bridge.js';
import TChannelAsThrift from 'tchannel/as/thrift';
import TChannelAsJSON from 'tchannel/as/json';
import Utils from '../src/util.js';

describe ('test tchannel span bridge', () => {
    // BIG_TIMEOUT is useful for debugging purposes
    let BIG_TIMEOUT = 15000000;

    let tracer = new Tracer(
        'test-service',
        new InMemoryReporter(),
        new ConstSampler(true)
    );

    let options = [
        { description: 'tchannelAsJson', channelEncoding: TChannelAsJSON },
        { description: 'tchannelAsThrift', channelEncoding: TChannelAsThrift }
    ];

    _.each(options, (o) => {

        it (o.description + ' spans propagate through tchannel and preserve parent span properties', function tchTest1(done) {
            let span = tracer.startSpan('futurama');
            span.setBaggageItem('leela', 'fry');
            let headers = TChannelBridge.saveTracerStateToCarrier(span);
            TChannelBridge.saveBaggageToCarrier(span, headers);
            let server = new TChannel({
                serviceName: 'server',
                trace: true,
                forceTrace: true
            });
            // Server calls client channel after it starts listening.
            server.listen(4040, '127.0.0.1', onServerListening);


            // Create the toplevel client channel.
            let client = new TChannel({
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
            encodedChannel.register(server, 'Echo::echo', context, handleServerReq);
            function handleServerReq(context, req, head, body, callback) {

                callback(null, {
                    ok: true,
                    head: head,
                    body: body
                });
            }

            function onServerListening() {
                let req = encodedChannel.request({
                    serviceName: 'server',
                    // We don't want tchannel to generate any spans.
                    parent: {span: TChannelBridge.getTChannelParentSpan() },
                    headers: { cn: 'echo' },
                    timeout: BIG_TIMEOUT
                });
                clientSubChannel.trace = false;
                server.trace = false;
                req.trace = false;

                req.send('Echo::echo', headers, { value: 'some-string' }, (err, res, arg2, arg3) => {
                    assert.isNotOk(err);
                    let receivedSpan = TChannelBridge.getSpanFromTChannelRequest(tracer, 'nibbler', res.head);
                    assert.equal(receivedSpan.name, 'nibbler');
                    assert.equal(span.context().traceIdStr, receivedSpan.context().traceIdStr);

                    let headers = res.head[constants.TCHANNEL_TRACING_PREFIX + constants.TRACER_STATE_HEADER_NAME].split(':');
                    let traceId = headers[0];
                    let spanId = headers[1];
                    let flags = parseInt(headers[3]);

                    assert.equal(span.context().traceIdStr, traceId);
                    assert.equal(span.context().spanIdStr, spanId);
                    assert.equal(span.context().parentId, null);
                    assert.equal(span.context().flags, flags);
                    server.close();
                    client.close();

                    done();
                });
            }
        }).timeout(BIG_TIMEOUT);
    });

    it ('saveBaggageToCarrier', () => {
        let headers = {
            'leela': 'fry',
            'bender': 'zoidberg'
        };
        let span = tracer.startSpan('futurama');
        span.setBaggageItem('leela', 'fry');
        span.setBaggageItem('bender', 'zoidberg');
        let carrier = TChannelBridge.saveBaggageToCarrier(span);

        assert.equal(carrier[`${constants.TRACER_BAGGAGE_HEADER_PREFIX}leela`], 'fry');
        assert.equal(carrier[`${constants.TRACER_BAGGAGE_HEADER_PREFIX}bender`], 'zoidberg');
    });

    it ('saveTracerStateToCarrier', () => {
        let span = tracer.startSpan('futurama');
        let carrier = TChannelBridge.saveTracerStateToCarrier(span);
        assert.equal(carrier[constants.TCHANNEL_TRACING_PREFIX + constants.TRACER_STATE_HEADER_NAME], span.context().toString());
    });
});

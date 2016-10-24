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
import * as constants from '../../src/constants';
import * as crossdock_constants from '../src/constants';
import ConstSampler from '../../src/samplers/const_sampler.js';
import InMemoryReporter from '../../src/reporters/in_memory_reporter.js';
import TChannelBridge from '../../src/tchannel_bridge';
import TChannelServer from '../src/tchannel_server.js';
import TChannelAsThrift from 'tchannel/as/thrift';
import TChannel from 'tchannel';
import Tracer from '../../src/tracer.js';
import fs from 'fs';
import path from 'path';
import Utils from '../../src/util.js';

// WARNING THESE TESTS DO NOT WORK WHEN THE VPN IS RUNNING.

describe('crossdock tchannel server should', () => {
    let ip;
    let server;
    let crossdockSpecPath = path.join(__dirname, '..', '..', 'src', 'jaeger-idl', 'thrift', 'crossdock', 'tracetest.thrift');

    before(() => {
        server = new TChannelServer(crossdockSpecPath);
        ip = Utils.myIp();
    });


    describe('joinTrace with different options', () => {
        let tracer = new Tracer('node', new InMemoryReporter(), new ConstSampler(false));
        let span = tracer.startSpan('test-span');

        let httpHeaders = {};
        httpHeaders[`${constants.TRACER_BAGGAGE_HEADER_PREFIX}${crossdock_constants.BAGGAGE_KEY}`] = 'fry';


        let tchannelHeaders = {};
        tchannelHeaders[`${crossdock_constants.TCHANNEL_HEADER_TRACER_STATE_KEY}`] = span.context().toString();
        tchannelHeaders[`${crossdock_constants.TCHANNEL_TRACING_PREFIX}uberctx-${crossdock_constants.BAGGAGE_KEY}`] = 'fry';

        let options = [
            { headers: httpHeaders },
            { headers: tchannelHeaders }
        ];

        _.each(options, (o) => {
            it ('propagates trace, and baggage on tchannel joinTrace', (done) => {
                let clientChannel = new TChannel();

                let baggageValue = 'fry';
                span.setBaggageItem(crossdock_constants.BAGGAGE_KEY, baggageValue);

                let thriftSpan = TChannelBridge.toTChannelSpan(span);
                var requestChannel = clientChannel.makeSubChannel({
                    serviceName: 'node',
                    peers: [Utils.myIp() + ':8082']
                });
                var tchannelAsThrift = TChannelAsThrift({
                    channel: requestChannel,
                    entryPoint: crossdockSpecPath
                });

                let joinRequest = {
                    'serverRole': 'S1',
                    'downstream': {
                        'serviceName': 'node',
                        'serverRole': 'S1',
                        'host': Utils.myIp(),
                        'port': '8082',
                        'transport': 'TCHANNEL'
                    }
                };

                tchannelAsThrift.request({
                    timeout: 100000,
                    serviceName: 'node',
                    headers: {
                        cn: 'node-tchannel'
                    },
                    parent: { span: thriftSpan }
                }).send('TracedService::joinTrace',
                    o.headers,
                    {'request': joinRequest},
                    (err, res) => {
                        if (err) {
                            console.log('got error', err);
                        } else {
                            let traceResponse = res.body;
                            assert.equal(traceResponse.span.traceId, span.context().traceIdStr);
                            assert.equal(traceResponse.span.traceId, traceResponse.downstream.span.traceId);
                            assert.equal(traceResponse.span.sampled, false);
                            assert.equal(traceResponse.span.baggage, span.getBaggageItem(crossdock_constants.BAGGAGE_KEY));
                        }
                        done();
                    }
                );
            }).timeout(100000);
        });
    });
});

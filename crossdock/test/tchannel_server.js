// Copyright (c) 2016 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed under the License
// is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied. See the License for the specific language governing permissions and limitations under
// the License.

import _ from 'lodash';
import {assert} from 'chai';
import * as constants from '../../src/constants';
import * as crossdock_constants from '../src/constants';
import ConstSampler from '../../src/samplers/const_sampler.js';
import DefaultContext from '../../src/default_context';
import opentracing from 'opentracing';
import InMemoryReporter from '../../src/reporters/in_memory_reporter.js';
import TChannelBridge from '../../src/tchannel_bridge';
import TChannelServer from '../src/tchannel_server.js';
import TChannelAsThrift from 'tchannel/as/thrift';
import TChannel from 'tchannel';
import Tracer from '../../src/tracer.js';
import fs from 'fs';
import path from 'path';
import Utils from '../../src/util.js';

process.env.NODE_ENV = 'test';

// WARNING THESE TESTS DO NOT WORK WHEN THE VPN IS RUNNING.

describe('crossdock tchannel server should', () => {
    let ip;
    let server;
    let tracer;
    let bridge;
    let crossdockSpecPath = path.join(__dirname, '..', '..', 'src', 'jaeger-idl', 'thrift', 'crossdock', 'tracetest.thrift');

    before(() => {
        tracer = new Tracer('node', new InMemoryReporter(), new ConstSampler(false));
        bridge = new TChannelBridge(tracer);
        server = new TChannelServer(crossdockSpecPath);
        ip = Utils.myIp();
    });


    describe('joinTrace with different options', () => {

        it ('propagate span state on tchannel joinTrace', (done) => {
            let span = tracer.startSpan('test-span');
            span.setBaggageItem(crossdock_constants.BAGGAGE_KEY, 'fry');

            let clientChannel = new TChannel();

            let requestChannel = clientChannel.makeSubChannel({
                serviceName: 'node',
                peers: [Utils.myIp() + ':8082']
            });
            let thriftChannel = TChannelAsThrift({
                channel: requestChannel,
                entryPoint: crossdockSpecPath
            });
            let tracedChannel = bridge.tracedChannel(thriftChannel);

            let joinRequest = {
                'serverRole': 'S1',
                'downstream': {
                    'serviceName': 'node',
                    'serverRole': 'S2',
                    'host': Utils.myIp(),
                    'port': '8082',
                    'transport': 'TCHANNEL'
                }
            };

            let context = new DefaultContext();
            context.setSpan(span);
            tracedChannel.request({
                timeout: 100000,
                context: context,
                serviceName: 'node',
                headers: {
                    cn: 'node-tchannel'
                },
            }).send('TracedService::joinTrace',
                null,
                {'request': joinRequest},
                (err, res) => {
                    if (err) {
                        assert.isNotOk(err);
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

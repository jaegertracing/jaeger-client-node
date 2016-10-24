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
import DebugLogtron from 'debug-logtron';
import fs from 'fs';
import path from 'path';
import InMemoryReporter from '../src/reporters/in_memory_reporter';
import MockTChannelReporter from './lib/mock_tchannel_reporter.js';
import opentracing from 'opentracing';
import process from 'process';
import TestUtils from '../src/test_util';
import Tracer from '../src/tracer';
import { getMockCollector } from './lib/util.js';
import { getTCollectorChannel } from './lib/util.js';
import TChannel from 'tchannel';
import TChannelThrift from 'tchannel/as/thrift';
import TChannelBridge from '../src/tchannel_bridge.js';
import Utils from '../src/util.js';
import yaml from 'js-yaml';

describe ('test tchannel span bridge', () => {
    let config = yaml.safeLoad(fs.readFileSync(path.join(__dirname, 'config/basic_tracer.yaml')));
    let tracer = new Tracer(
        'test-service',
        new InMemoryReporter(),
        new ConstSampler(true)
    );
    let spans = [
        TChannelBridge.toTChannelSpan(tracer.startSpan('operation')),
        TChannelBridge.toTChannelv2Span(tracer.startSpan('operation'))
    ];

    _.each(spans, (span) => {
        it ('continuation span is reported to tchannel reporter with proper trace id and parent id', (endTest) => {
            let mockTCollectorHost = process.env.FAKE_COLLECTOR_HOST || '127.0.0.1';
            let mockTCollectorPort = parseInt(process.env.PROXY_COLLECTOR_PORT) || 30000;
            let mockReporter = new MockTChannelReporter();
            let logger = new DebugLogtron('logger');
            let samplingSpec = fs.readFileSync(path.join(__dirname, '..', 'src', 'jaeger-idl', 'thrift', 'sampling.thrift'), 'utf8');

            getMockCollector({
                reporter: mockReporter,
                reportTracing: true,
                hyperbahnClientName: 'tcollector',
                channelName: 'tcollector',
                logger: logger,
                host: mockTCollectorHost,
                port: mockTCollectorPort
            }, (mockTCollector, doneWithMockCollector) => {
                    getTCollectorChannel({
                        channelName: 'tcollector-requestor',
                        hyperbahnClientName: 'tcollector-requestor',
                        reportTracing: true,
                        logger: logger,
                        host: mockTCollectorHost,
                        port: mockTCollectorPort
                    }, (tcollectorChannel, done) => {
                        let channel = TChannelThrift({
                            channel: tcollectorChannel,
                            source: samplingSpec
                    });

                    let request = channel.request({
                        timeout: 100,
                        parent: {span: span},
                        headers: {
                            cn: 'tcollector-requestor'
                        },
                        trace: true,
                        serviceName: 'tcollector',
                        retryFlags: {never: true}
                    });

                    request.send(
                        'SamplingManager::getSamplingStrategy',
                        { other: 'string' },
                        {serviceName: 'tcollector-static'},
                        (err, response) => {
                            assert.isOk(response.body, 'assert we submitted a thrift span');
                            let continuedSpan = mockReporter.spans[0];
                            assert.equal(span.id[0], continuedSpan.parentid[0]);
                            assert.equal(span.traceid[0], continuedSpan.traceid[0]);
                            assert.equal(span.id[1], continuedSpan.parentid[1]);
                            assert.equal(span.traceid[1], continuedSpan.traceid[1]);
                            doneWithMockCollector();
                            done();
                            endTest();
                    });
                });
            });
        });
    });

    it ('saveBaggageToHeaders', () => {
        let headers = {
            'leela': 'fry',
            'bender': 'zoidberg'
        };
        let carrier = {};
        TChannelBridge.saveBaggageToHeaders(headers, carrier);

        assert.equal(carrier[`${constants.TRACER_BAGGAGE_HEADER_PREFIX}leela`], 'fry');
        assert.equal(carrier[`${constants.TRACER_BAGGAGE_HEADER_PREFIX}bender`], 'zoidberg');
    });

    it ('getSpanFromTChannelRequest', function tchTest1(done) {
            let server = new TChannel({});
            let client = new TChannel();

            let serverChan = server.makeSubChannel({serviceName: 'server'});
            serverChan.register('func', handleServerReq);
            server.listen(0, '127.0.0.1', onServerListening);

            function onServerListening() {
                let clientChan = client.makeSubChannel({
                    serviceName: 'server',
                    peers: [server.hostPort],
                    requestDefaults: { 
                        hasNoParent: true,
                        headers: {as: 'raw', cn: 'test-client'}
                    }
                });

                let req = clientChan.request({serviceName: 'server', timeout: 1500});
                req.send('func', 'head', 'body', onResponse);
            }

            function handleServerReq(req, res, arg2, arg3) {
                let span = TChannelBridge.getSpanFromTChannelRequest(tracer, req);

                let spanid = Utils.tchannelBufferToIntId(span.spanId);
                let traceid = Utils.tchannelBufferToIntId(span.traceId);
                let parentid = Utils.tchannelBufferToIntId(span.parentId);
                deepEqual(spanid, req.span.id);
                deepEqual(traceid, req.span.traceid);
                deepEqual(parentid, req.span.parentid);

                assert.equal('func', span._operationName);

                res.headers.as = 'raw';
                res.sendOk('result', 'done');
            }

            function onResponse(err, res, arg2, arg3) {
                assert.isNotOk(err);
                server.close();
                client.close();

                done();
            }
    });
});

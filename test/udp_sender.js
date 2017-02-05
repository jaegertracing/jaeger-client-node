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
import ConstSampler from '../src/samplers/const_sampler.js';
import dgram from 'dgram';
import fs from 'fs';
import path from 'path';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import opentracing from 'opentracing';
import Tracer from '../src/tracer.js';
import {Thrift} from 'thriftrw';
import ThriftUtils from '../src/thrift.js';
import UDPSender from '../src/reporters/udp_sender.js';

const PORT = 6832;
const HOST = '127.0.0.1';

describe('udp sender should', () => {
    let server;
    let tracer;
    let thrift;
    let sender;

    function assertThriftSpanEqual(assert, spanOne, spanTwo) {
        assert.deepEqual(spanOne.traceIdLow, spanTwo.traceIdLow);
        assert.deepEqual(spanOne.traceIdHigh, spanTwo.traceIdHigh);
        assert.deepEqual(spanOne.spanId, spanTwo.spanId);
        assert.deepEqual(spanOne.parentSpanId, spanTwo.parentSpanId);
        assert.equal(spanOne.operationName, spanTwo.operationName);
        assert.deepEqual(spanOne.references, spanTwo.references);
        assert.equal(spanOne.flags, spanTwo.flags);
        assert.deepEqual(spanOne.startTime, spanTwo.startTime);
        assert.deepEqual(spanOne.duration, spanTwo.duration);
    }

    beforeEach(() => {
        server = dgram.createSocket('udp4');
        server.bind(PORT, HOST);
        let reporter = new InMemoryReporter();
        tracer = new Tracer(
            'test-service-name',
            reporter,
            new ConstSampler(true)
        );
        sender = new UDPSender();
        sender.setProcess(reporter._process);
        thrift = new Thrift({
            source: fs.readFileSync(path.join(__dirname, '../src/jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
            allowOptionalArguments: true
        });
    });

    afterEach(() => {
        tracer.close();
        server.close();
    });

    it ('read and verify spans and process sent', (done) => {
        let spanOne = tracer.startSpan('operation-one');
        spanOne.finish(); // finish to set span duration
        spanOne = ThriftUtils.spanToThrift(spanOne);
        let spanTwo = tracer.startSpan('operation-two');
        spanTwo.finish(); // finish to set span duration
        spanTwo = ThriftUtils.spanToThrift(spanTwo);

        // make sure sender can fit both spans
        let maxSpanBytes = sender._calcSpanSize(spanOne) + sender._calcSpanSize(spanTwo) + 30;
        sender._maxSpanBytes = maxSpanBytes;

        server.on('message', (msg, remote) => {
            let thriftObj = thrift.Agent.emitBatch.argumentsMessageRW.readFrom(msg, 0);
            let batch = thriftObj.value.body.batch;
            assert.isOk(batch);
            assert.equal(batch.spans.length, 2);

            assertThriftSpanEqual(assert, spanOne, batch.spans[0]);
            assertThriftSpanEqual(assert, spanTwo, batch.spans[1]);

            assert.equal(batch.process.serviceName, 'test-service-name');
            let actualTags = _.sortBy(batch.process.tags, (o) => {
                return o.key;
            });
            assert.equal(actualTags.length, 3);
            assert.equal(actualTags[0].key, 'jaeger.hostname');
            assert.equal(actualTags[1].key, 'jaeger.version');
            assert.equal(actualTags[2].key, 'peer.ipv4');

            sender.close();
            done();
        });

        sender.append(spanOne);
        sender.append(spanTwo);
        sender.flush();
    });

    describe('span reference tests', () => {
        let tracer = new Tracer(
            'test-service-name',
            new InMemoryReporter(),
            new ConstSampler(true)
        );
        let parentContext = tracer.startSpan('just-used-for-context').context();
        let childOfContext = tracer.startSpan('just-used-for-context').context();
        let childOfRef = new opentracing.Reference(opentracing.REFERENCE_CHILD_OF, childOfContext);
        let followsFromContext = tracer.startSpan('just-used-for-context').context();
        let followsFromRef = new opentracing.Reference(opentracing.REFERENCE_FOLLOWS_FROM, followsFromContext);

        let options = [
            { 'childOf': null, 'references': [], 'expectedTraceId': null, 'expectedParentId': null },
            { 'childOf': parentContext, 'references': [], 'expectedTraceId': parentContext.traceId, 'expectedParentId': parentContext.parentId },
            { 'childOf': parentContext, 'references': [followsFromRef], 'expectedTraceId': parentContext.traceId, 'expectedParentId': parentContext.parentId },
            { 'childOf': parentContext, 'references': [childOfRef, followsFromRef], 'expectedTraceId': parentContext.traceId, 'expectedParentId': parentContext.parentId},
            { 'childOf': null, 'references': [childOfRef], 'expectedTraceId': childOfContext.traceId, 'expectedParentId': childOfContext.parentId },
            { 'childOf': null, 'references': [followsFromRef], 'expectedTraceId': followsFromContext.traceId, 'expectedParentId': followsFromContext.parentId },
            { 'childOf': null, 'references': [childOfRef, followsFromRef], 'expectedTraceId': childOfContext.traceId, 'expectedParentId': childOfContext.parentId }
        ];

        _.each(options, (o) => {
            it ('span references serialize', (done) => {

                let span = tracer.startSpan('bender', {
                    childOf: o.childOf,
                    references: o.references
                });
                span.finish();
                span = ThriftUtils.spanToThrift(span);

                server.on('message', function(msg, remote) {
                    let thriftObj = thrift.Agent.emitBatch.argumentsMessageRW.readFrom(msg, 0);
                    let batch = thriftObj.value.body.batch;
                    let span = batch.spans[0];
                    let ref = span.references[0];

                    assert.isOk(batch);
                    assertThriftSpanEqual(assert, span, batch.spans[0]);
                    if (o.expectedTraceId) {
                        assert.deepEqual(span.traceIdLow, o.expectedTraceId);
                    }

                    if (o.expectedParentId) {
                        assert.deepEqual(span.parentId, o.expectedParentId);
                    } else {
                        assert.isNotOk(span.parentId);
                    }

                    sender.close();
                    done();
                });

                sender.append(span);
                sender.flush();
            });
        });
    });

    it ('flush spans when capacity is reached', () => {
        let spanOne = tracer.startSpan('operation-one');
        spanOne.finish(); // finish to set span duration
        spanOne = ThriftUtils.spanToThrift(spanOne);
        sender._maxSpanBytes = 1;
        let spanSize = sender._calcSpanSize(spanOne);
        sender._maxSpanBytes = spanSize * 2;

        let responseOne = sender.append(spanOne);
        let responseTwo = sender.append(spanOne);

        assert.equal(responseOne.err, false);
        assert.equal(responseOne.numSpans, 0);
        assert.equal(responseTwo.err, false);
        assert.equal(responseTwo.numSpans, 2);

        assert.equal(sender._batch.spans.length, 0);
        assert.equal(sender._byteBufferSize, 0);
    });

    it ('flush spans when just over capacity', () => {
        let spanOne = tracer.startSpan('operation-one');
        spanOne.finish(); // finish to set span duration
        spanOne = ThriftUtils.spanToThrift(spanOne);
        let spanSize = sender._calcSpanSize(spanOne);
        sender._maxSpanBytes = spanSize * 2;

        let spanThatExceedsCapacity = tracer.startSpan('bigger-span');
        spanThatExceedsCapacity.setTag('some-key', 'some-value');
        spanThatExceedsCapacity.finish(); // finish to set span duration
        spanThatExceedsCapacity = ThriftUtils.spanToThrift(spanThatExceedsCapacity);

        let responseOne = sender.append(spanOne);
        let responseTwo = sender.append(spanThatExceedsCapacity);
        let expectedBufferSize = sender._calcSpanSize(spanThatExceedsCapacity);

        assert.equal(sender._batch.spans.length, 1);
        assert.equal(sender._byteBufferSize, expectedBufferSize);
        assert.equal(responseOne.err, false);
        assert.equal(responseOne.numSpans, 0);
        assert.equal(responseTwo.err, false);
        assert.equal(responseTwo.numSpans, 1);
    });

    it('flush returns error, on failed buffer conversion', () => {
        let span = tracer.startSpan('leela');
        span.finish(); // finish to set span duration
        span = ThriftUtils.spanToThrift(span);
        span.flags = 'string'; // malform the span to create a serialization error
        sender.append(span);
        let response = sender.flush();
        assert.isOk(response.err);
        assert.equal(response.numSpans, 1);
    });

    it ('return error response on span too large', () => {
        let span = tracer.startSpan('op-name');
        span.finish(); // otherwise duration will be undefined

        sender._maxSpanBytes = 1;
        let response = sender.append(ThriftUtils.spanToThrift(span));
        assert.isOk(response.err);
        assert.equal(response.numSpans, 1);
        sender.flush();

        // cleanup
        sender.close();
    });

    it ('flush with no spans returns false for error, and 0', () => {
        let response = sender.flush();

        assert.equal(response.err, false);
        assert.equal(response.numSpans, 0);
    });
});

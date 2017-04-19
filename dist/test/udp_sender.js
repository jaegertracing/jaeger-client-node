'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _chai = require('chai');

var _const_sampler = require('../src/samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _dgram = require('dgram');

var _dgram2 = _interopRequireDefault(_dgram);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _in_memory_reporter = require('../src/reporters/in_memory_reporter.js');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _tracer = require('../src/tracer.js');

var _tracer2 = _interopRequireDefault(_tracer);

var _thriftrw = require('thriftrw');

var _thrift = require('../src/thrift.js');

var _thrift2 = _interopRequireDefault(_thrift);

var _udp_sender = require('../src/reporters/udp_sender.js');

var _udp_sender2 = _interopRequireDefault(_udp_sender);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

var PORT = 6832;
var HOST = '127.0.0.1';

describe('udp sender should', function () {
    var server = void 0;
    var tracer = void 0;
    var thrift = void 0;
    var sender = void 0;

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

    beforeEach(function () {
        server = _dgram2.default.createSocket('udp4');
        server.bind(PORT, HOST);
        var reporter = new _in_memory_reporter2.default();
        tracer = new _tracer2.default('test-service-name', reporter, new _const_sampler2.default(true));
        sender = new _udp_sender2.default();
        sender.setProcess(reporter._process);
        thrift = new _thriftrw.Thrift({
            source: _fs2.default.readFileSync(_path2.default.join(__dirname, '../src/jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
            allowOptionalArguments: true
        });
    });

    afterEach(function () {
        tracer.close();
        server.close();
    });

    it('read and verify spans and process sent', function (done) {
        var spanOne = tracer.startSpan('operation-one');
        spanOne.finish(); // finish to set span duration
        spanOne = _thrift2.default.spanToThrift(spanOne);
        var spanTwo = tracer.startSpan('operation-two');
        spanTwo.finish(); // finish to set span duration
        spanTwo = _thrift2.default.spanToThrift(spanTwo);

        // make sure sender can fit both spans
        var maxSpanBytes = sender._calcSpanSize(spanOne) + sender._calcSpanSize(spanTwo) + 30;
        sender._maxSpanBytes = maxSpanBytes;

        server.on('message', function (msg, remote) {
            var thriftObj = thrift.Agent.emitBatch.argumentsMessageRW.readFrom(msg, 0);
            var batch = thriftObj.value.body.batch;
            _chai.assert.isOk(batch);
            _chai.assert.equal(batch.spans.length, 2);

            assertThriftSpanEqual(_chai.assert, spanOne, batch.spans[0]);
            assertThriftSpanEqual(_chai.assert, spanTwo, batch.spans[1]);

            _chai.assert.equal(batch.process.serviceName, 'test-service-name');
            var actualTags = _lodash2.default.sortBy(batch.process.tags, function (o) {
                return o.key;
            });
            _chai.assert.equal(actualTags.length, 3);
            _chai.assert.equal(actualTags[0].key, 'jaeger.hostname');
            _chai.assert.equal(actualTags[1].key, 'jaeger.version');
            _chai.assert.equal(actualTags[2].key, 'peer.ipv4');

            sender.close();
            done();
        });

        sender.append(spanOne);
        sender.append(spanTwo);
        sender.flush();
    });

    describe('span reference tests', function () {
        var tracer = new _tracer2.default('test-service-name', new _in_memory_reporter2.default(), new _const_sampler2.default(true));
        var parentContext = tracer.startSpan('just-used-for-context').context();
        var childOfContext = tracer.startSpan('just-used-for-context').context();
        var childOfRef = new _opentracing2.default.Reference(_opentracing2.default.REFERENCE_CHILD_OF, childOfContext);
        var followsFromContext = tracer.startSpan('just-used-for-context').context();
        var followsFromRef = new _opentracing2.default.Reference(_opentracing2.default.REFERENCE_FOLLOWS_FROM, followsFromContext);

        var options = [{ 'childOf': null, 'references': [], 'expectedTraceId': null, 'expectedParentId': null }, { 'childOf': parentContext, 'references': [], 'expectedTraceId': parentContext.traceId, 'expectedParentId': parentContext.parentId }, { 'childOf': parentContext, 'references': [followsFromRef], 'expectedTraceId': parentContext.traceId, 'expectedParentId': parentContext.parentId }, { 'childOf': parentContext, 'references': [childOfRef, followsFromRef], 'expectedTraceId': parentContext.traceId, 'expectedParentId': parentContext.parentId }, { 'childOf': null, 'references': [childOfRef], 'expectedTraceId': childOfContext.traceId, 'expectedParentId': childOfContext.parentId }, { 'childOf': null, 'references': [followsFromRef], 'expectedTraceId': followsFromContext.traceId, 'expectedParentId': followsFromContext.parentId }, { 'childOf': null, 'references': [childOfRef, followsFromRef], 'expectedTraceId': childOfContext.traceId, 'expectedParentId': childOfContext.parentId }];

        _lodash2.default.each(options, function (o) {
            it('span references serialize', function (done) {

                var span = tracer.startSpan('bender', {
                    childOf: o.childOf,
                    references: o.references
                });
                span.finish();
                span = _thrift2.default.spanToThrift(span);

                server.on('message', function (msg, remote) {
                    var thriftObj = thrift.Agent.emitBatch.argumentsMessageRW.readFrom(msg, 0);
                    var batch = thriftObj.value.body.batch;
                    var span = batch.spans[0];
                    var ref = span.references[0];

                    _chai.assert.isOk(batch);
                    assertThriftSpanEqual(_chai.assert, span, batch.spans[0]);
                    if (o.expectedTraceId) {
                        _chai.assert.deepEqual(span.traceIdLow, o.expectedTraceId);
                    }

                    if (o.expectedParentId) {
                        _chai.assert.deepEqual(span.parentId, o.expectedParentId);
                    } else {
                        _chai.assert.isNotOk(span.parentId);
                    }

                    sender.close();
                    done();
                });

                sender.append(span);
                sender.flush();
            });
        });
    });

    it('flush spans when capacity is reached', function () {
        var spanOne = tracer.startSpan('operation-one');
        spanOne.finish(); // finish to set span duration
        spanOne = _thrift2.default.spanToThrift(spanOne);
        sender._maxSpanBytes = 1;
        var spanSize = sender._calcSpanSize(spanOne);
        sender._maxSpanBytes = spanSize * 2;

        var responseOne = sender.append(spanOne);
        var responseTwo = sender.append(spanOne);

        _chai.assert.equal(responseOne.err, false);
        _chai.assert.equal(responseOne.numSpans, 0);
        _chai.assert.equal(responseTwo.err, false);
        _chai.assert.equal(responseTwo.numSpans, 2);

        _chai.assert.equal(sender._batch.spans.length, 0);
        _chai.assert.equal(sender._byteBufferSize, 0);
    });

    it('flush spans when just over capacity', function () {
        var spanOne = tracer.startSpan('operation-one');
        spanOne.finish(); // finish to set span duration
        spanOne = _thrift2.default.spanToThrift(spanOne);
        var spanSize = sender._calcSpanSize(spanOne);
        sender._maxSpanBytes = spanSize * 2;

        var spanThatExceedsCapacity = tracer.startSpan('bigger-span');
        spanThatExceedsCapacity.setTag('some-key', 'some-value');
        spanThatExceedsCapacity.finish(); // finish to set span duration
        spanThatExceedsCapacity = _thrift2.default.spanToThrift(spanThatExceedsCapacity);

        var responseOne = sender.append(spanOne);
        var responseTwo = sender.append(spanThatExceedsCapacity);
        var expectedBufferSize = sender._calcSpanSize(spanThatExceedsCapacity);

        _chai.assert.equal(sender._batch.spans.length, 1);
        _chai.assert.equal(sender._byteBufferSize, expectedBufferSize);
        _chai.assert.equal(responseOne.err, false);
        _chai.assert.equal(responseOne.numSpans, 0);
        _chai.assert.equal(responseTwo.err, false);
        _chai.assert.equal(responseTwo.numSpans, 1);
    });

    it('flush returns error, on failed buffer conversion', function () {
        var span = tracer.startSpan('leela');
        span.finish(); // finish to set span duration
        span = _thrift2.default.spanToThrift(span);
        span.flags = 'string'; // malform the span to create a serialization error
        sender.append(span);
        var response = sender.flush();
        _chai.assert.isOk(response.err);
        _chai.assert.equal(response.numSpans, 1);
    });

    it('return error response on span too large', function () {
        var span = tracer.startSpan('op-name');
        span.finish(); // otherwise duration will be undefined

        sender._maxSpanBytes = 1;
        var response = sender.append(_thrift2.default.spanToThrift(span));
        _chai.assert.isOk(response.err);
        _chai.assert.equal(response.numSpans, 1);
        sender.flush();

        // cleanup
        sender.close();
    });

    it('flush with no spans returns false for error, and 0', function () {
        var response = sender.flush();

        _chai.assert.equal(response.err, false);
        _chai.assert.equal(response.numSpans, 0);
    });
});
//# sourceMappingURL=udp_sender.js.map
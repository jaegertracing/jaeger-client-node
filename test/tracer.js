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
import bufferEqual from 'buffer-equal';
import ConstSampler from '../src/samplers/const_sampler.js';
import * as constants from '../src/constants.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import * as opentracing from 'opentracing';
import {Tags as opentracing_tags} from 'opentracing';
import SpanContext from '../src/span_context.js';
import Tracer from '../src/tracer.js';
import Utils from '../src/util.js';

describe('tracer should', () => {
    let tracer;
    let reporter = new InMemoryReporter();

    beforeEach(() => {
        tracer = new Tracer(
            'test-service-name',
            reporter,
            new ConstSampler(true)
        );
    });

    afterEach(() => {
        reporter.clear();
        tracer.close();
    });

    it('create a span correctly through _startInternalSpan', () => {
        let traceId = Utils.encodeInt64(1);
        let spanId = Utils.encodeInt64(2);
        let parentId = Utils.encodeInt64(3);
        let flags = 1;
        let context = new SpanContext(traceId, spanId, parentId, flags);
        let start = Utils.getTimestampMicros();
        let rpcServer = false;
        let internalTags = [];
        let tags = {
            'keyOne': 'leela',
            'keyTwo': 'bender'
        };
        let span = tracer._startInternalSpan(context, 'op-name', start, internalTags, tags, rpcServer);

        assert.isOk(bufferEqual(span.context().traceId, traceId));
        assert.isOk(bufferEqual(span.context().spanId, spanId));
        assert.isOk(bufferEqual(span.context().parentId, parentId));
        assert.equal(span.context().flags, flags);
        assert.equal(span._startTime, start);
        assert.isNotOk(span._firstInProcess);
        assert.equal(Object.keys(span._tags).length, 2);
    });

    it ('report a span with tracer level tags', () => {
        let span = tracer.startSpan('op-name');
        tracer._report(span);
        assert.isOk(reporter.spans.length, 1);
        let actualTags = _.sortBy(span._tags, (o) => {
            return o.key;
        });

        assert.equal(actualTags[0].key, 'jaeger.hostname');
        assert.equal(actualTags[1].key, 'jaeger.version');
        assert.equal(actualTags[2].key, 'sampler.param');
        assert.equal(actualTags[3].key, 'sampler.type');
        assert.equal(actualTags[2].value, true);
        assert.equal(actualTags[3].value, 'const');
    });

    it ('start a root span with proper structure', () => {
        let startTime = new Date(2016, 8, 18).getTime();
        let span = tracer.startSpan('test-name', {
            startTime: startTime
        });

        assert.equal(span.context().traceId, span.context().spanId);
        assert.isNotOk(span.context().parentId);
        assert.isOk(span.context().isSampled());
        assert.equal(span._startTime, startTime);
    });

    it ('start a child span represented as a separate span from parent, using childOf and references', () => {
        let traceId = Utils.encodeInt64(1);
        let spanId = Utils.encodeInt64(2);
        let parentId = Utils.encodeInt64(3);
        let flags = 1;
        let context = new SpanContext(traceId, spanId, parentId, flags);
        let startTime = Utils.getTimestampMicros();

        let childOfParams = {
            operationName: 'test-name',
            childOf: context,
            startTime, startTime
        };

        let referenceParams = {
            operationName: 'test-name',
            startTime, startTime,
            references: [new opentracing.Reference(opentracing.REFERENCE_CHILD_OF, context)],
        };

        let assertByStartSpanParameters = (params) => {
            let span = tracer.startSpan('test-span', params);
            assert.isOk(bufferEqual(span.context().traceId, traceId));
            assert.isOk(bufferEqual(span.context().parentId, spanId));
            assert.equal(span.context().flags, constants.SAMPLED_MASK);
            assert.equal(span._startTime, startTime);
        }

        assertByStartSpanParameters(childOfParams);
        assertByStartSpanParameters(referenceParams);
    });

    it ('start a child span represented as same span (Zipkins one-span-per-rpc)', () => {
        let traceId = Utils.encodeInt64(1);
        let spanId = Utils.encodeInt64(2);
        let parentId = Utils.encodeInt64(3);
        let flags = 1;
        let context = new SpanContext(traceId, spanId, parentId, flags);
        let startTime = Utils.getTimestampMicros();

        let tags = {};
        tags[`${opentracing_tags.SPAN_KIND}`] = opentracing_tags.SPAN_KIND_RPC_SERVER;

        let childOfParams = {
            operationName: 'test-name',
            childOf: context,
            startTime: startTime,
            tags
        }

        let referenceParams = {
            operationName: 'test-name',
            references: [new opentracing.Reference(opentracing.REFERENCE_CHILD_OF, context)],
            startTime: startTime,
            tags
        }

        let assertByStartSpanParameters = (params) => {
            let span = tracer.startSpan('test-span', params);

            assert.isOk(bufferEqual(span.context().traceId, traceId));
            assert.isOk(bufferEqual(span.context().parentId, parentId));
            assert.isOk(span.context().isSampled());
            assert.equal(span._startTime, startTime);
        }

        assertByStartSpanParameters(childOfParams);
        assertByStartSpanParameters(referenceParams);
    });

    it ('inject plain text headers into carrier, and extract span context with the same value', () => {
        let keyOne = 'keyOne';
        let keyTwo = 'keyTwo';
        let baggage = {
            keyOne: 'leela',
            keyTwo: 'bender'
        };
        let savedContext = new SpanContext(
            Utils.encodeInt64(1),
            Utils.encodeInt64(2),
            Utils.encodeInt64(3),
            constants.SAMPLED_MASK,
            baggage
        );

        let assertByFormat = (format) => {
            let carrier = {};
            tracer.inject(savedContext, format, carrier);
            let extractedContext = tracer.extract(format, carrier);

            assert.isOk(bufferEqual(savedContext.traceId, extractedContext.traceId));
            assert.isOk(bufferEqual(savedContext.spanId, extractedContext.spanId));
            assert.isOk(bufferEqual(savedContext.parentId, extractedContext.parentId));
            assert.equal(savedContext.flags, extractedContext.flags);
            assert.equal(savedContext.baggage[keyOne], extractedContext.baggage[keyOne]);
            assert.equal(savedContext.baggage[keyTwo], extractedContext.baggage[keyTwo]);
        }

        assertByFormat(opentracing.FORMAT_TEXT_MAP);
        assertByFormat(opentracing.FORMAT_HTTP_HEADERS);
    });

    it ('inject url encoded values into headers', () => {
        let baggage = {
            keyOne: 'Leela vs. Bender',
        };
        let savedContext = new SpanContext(
            Utils.encodeInt64(1),
            Utils.encodeInt64(2),
            Utils.encodeInt64(3),
            constants.SAMPLED_MASK,
            baggage
        );
        let carrier = {};

        tracer.inject(savedContext, opentracing.FORMAT_HTTP_HEADERS, carrier);
        assert.equal(carrier['uberctx-keyOne'], 'Leela%20vs.%20Bender');
    });

    it ('assert inject and extract throw errors when given an invalid format', () => {
        let carrier = {};
        let context = new SpanContext(
            Utils.encodeInt64(1),
            Utils.encodeInt64(2),
            Utils.encodeInt64(3),
            constants.SAMPLED_MASK
        );

        // subtle but expect wants a function to call not the result of a function call.
        expect(() => {tracer.inject(context, 'fake-format', carrier)}).to.throw('Unsupported format: fake-format');
        expect(() => {tracer.extract('fake-format', carrier)}).to.throw('Unsupported format: fake-format');
    });

    it ('report spans', () => {
        let span = tracer.startSpan('operation');
        tracer._report(span);

        assert.equal(reporter.spans.length, 1);
    });

    it ('flush spans', (done) => {
        let span = tracer.startSpan('operation');
        span.finish();

        // test callback for flush as well
        tracer.flush(() => {
            assert.equal(tracer._reporter._flushed.length, 1);
            done();
        });
    });
});

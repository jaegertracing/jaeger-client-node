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

import {assert} from 'chai';
import ConstSampler from '../src/samplers/const_sampler.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import opentracing from 'opentracing';
import SpanContext from '../src/span_context.js';
import Tracer from '../src/tracer.js';
import TestUtils from '../src/test_util.js';
import Utils from '../src/util.js';

describe('TestUtils', () => {
    let tracer;
    let span;
    let spanContext;

    before(() => {
        tracer = new Tracer(
            'test-tracer',
            new InMemoryReporter(),
            new ConstSampler(true)
        );
    });

    beforeEach(() => {
        span = tracer.startSpan('op-name');
        spanContext = SpanContext.fromString('ab:cd:ef:3');
    });

    it ('traceIdEqual', () => {
        span._spanContext = spanContext;

        assert.isOk(TestUtils.traceIdEqual(span, 0xab));
        span._spanContext.traceId = null;
        assert.isOk(TestUtils.traceIdEqual(span, null));
    });

    it ('spanIdEqual', () => {
        span._spanContext = spanContext;

        assert.isOk(TestUtils.spanIdEqual(span, 0xcd));
        span._spanContext.spanId = null;
        assert.isOk(TestUtils.spanIdEqual(span, null));
    });

    it ('parentIdEqual', () => {
        span._spanContext = spanContext;

        assert.isOk(TestUtils.parentIdEqual(span, 0xef));
        span._spanContext.parentId = null;
        assert.isOk(TestUtils.parentIdEqual(span, null));
    });

    it ('flagsEqual', () => {
        span._spanContext = spanContext;

        assert.isOk(TestUtils.flagsEqual(span, 3));
    });

    it ('operationNameEqual', () => {
        assert.isOk(TestUtils.operationNameEqual(span, 'op-name'));
    });

    it ('startTimeEqual', () => {
        assert.isOk(TestUtils.startTimeEqual(span, span._startTime));
    });

    it ('durationTimeEqual', () => {
        assert.isOk(TestUtils.durationEqual(span, span._duration));
    });

    it ('hasTags', () => {
        let tags = {
            'keyOne': 'valueOne',
            'keyTwo': 'valueTwo'
        };
        span.addTags(tags);

        assert.isOk(TestUtils.hasTags(span, tags));
    });

    it ('hasLogs', () => {
        let log1 = {
            'log1_key': 'some-log-value1',
        };

        let log2 = {
            'log2_key': 'some-log-value2'
        };

        let timestamp = Date.now();

        span.log(log1, timestamp);
        span.log(log2, timestamp);

        assert.isOk(TestUtils.hasLogs(span, [
            {
                'log2_key': 'some-log-value2',
                'timestamp': timestamp
            }, {
                'log2_key': 'some-log-value2',
                'timestamp': timestamp
            },
        ]))
    });

    it ('hasBaggage', () => {
        span.setBaggageItem('leela', 'fry');
        span.setBaggageItem('bender', 'zoidberg');

        assert.isOk(TestUtils.hasBaggage(span, {
            'leela': 'fry',
            'bender': 'zoidberg'
        }));
    });

    it ('isClient', () => {
        let tag = {};
        assert.isNotOk(TestUtils.isClient(span));
        tag[opentracing.Tags.SPAN_KIND] = opentracing.Tags.SPAN_KIND_RPC_CLIENT;
        span.addTags(tag);

        assert.isOk(TestUtils.isClient(span));
    });

    it ('is debugged and sampled', () => {
        span._setSamplingPriority(1);

        assert.isOk(TestUtils.isDebug(span));
        assert.isOk(TestUtils.isSampled(span));
    });

    it ('carrier has tracer state', () => {
        assert.isOk(TestUtils.carrierHasTracerState({'uber-trace-id': 'ab:ce:de:3'}));
    });

    it ('carrier has baggage', () => {
        let carrier = {
            'uberctx-keyone': 'valueone',
            'uberctx-keytwo': 'valuetwo'
        };

        let baggage = {
            'keyone': 'valueone',
            'keytwo': 'valuetwo'
        };

        assert.isOk(TestUtils.carrierHasBaggage(carrier, baggage));
    });
});

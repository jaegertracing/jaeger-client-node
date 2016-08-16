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
import * as constants from '../src/constants.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import Span from '../src/span.js';
import SpanContext from '../src/span_context.js';
import * as thrift from '../src/thrift.js';
import Tracer from '../src/tracer.js';
import Utils from '../src/util.js';

describe('span should', () => {
    let reporter = new InMemoryReporter();
    let tracer, span, spanContext;

    beforeEach(() => {
        tracer = new Tracer(
            'test-service-name',
            reporter,
            new ConstSampler(true)
        );

        spanContext = new SpanContext(
            Utils.encodeInt64(1),
            Utils.encodeInt64(2),
            Utils.encodeInt64(3),
            constants.SAMPLED_MASK
        );

        span = new Span(
            tracer,
            'op-name',
            spanContext,
            Utils.getTimestampMicros()
        );
    });

    it('return span context when context() is called', () => {
        assert.equal(span.context(), spanContext);
    });

    it('return tracer when tracer() is called', () => {
        assert.equal(span.tracer(), tracer);
    });

    it('set operation name correctly', () => {
        span.setOperationName('operation-name');
        assert.equal(span._name, 'operation-name');
    });

    it('finish span with custom duration', () => {
        let initialDate = new Date(2011, 9, 1).getTime();
        span._start = initialDate;
        let expectedDuration = 1000;
        let finishDate = initialDate + expectedDuration;

        span.finish(finishDate);

        assert.equal(span._duration, expectedDuration);
        assert.equal(reporter.spans.length, 1);
        assert.equal(reporter.spans[0], span);
    });

    it('add tags as binary annotations', () => {
        span.addTags({
            numberTag: 7,
            stringTag: 'string',
            booleanTag: true,
        });


        let keys = [];
        for (let i in span._binaryAnnotations) {
            keys.push(span._binaryAnnotations[i].key);
        }

        assert.equal(span._binaryAnnotations.length, 3);
        assert.equal(keys[0], 'numberTag');
        assert.equal(keys[1], 'stringTag');
        assert.equal(keys[2], 'booleanTag');
    });

    it('add logs as annotations', () => {
        let timestamp = new Date(2016, 8, 12).getTime();
        span.log({
            timestamp: timestamp,
            event: 'some message'
        });

        assert.equal(span._annotations.length, 1);
        assert.equal(span._annotations[0].timestamp, timestamp);
        assert.equal(span._annotations[0].value, 'some message');
    });

    it ('set and retrieve baggage correctly', () => {
        let key = 'some-key';
        let value = 'some-value';

        span.setBaggageItem(key, value);

        assert.equal(value, span.getBaggageItem(key));
    });

    it ('normalized key correctly', () => {
        let unnormalizedKey = 'SOME_KEY';
        let key = span._normalizeBaggageKey(unnormalizedKey);

        assert.equal(key, 'some-key');
        assert.isOk(unnormalizedKey in Span._getBaggageHeaderCache());
    });

    // TODO(oibe) need tests for standard tags, and handlers
});


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
import ConstSampler from '../src/samplers/const_sampler.js';
import * as constants from '../src/constants.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import Span from '../src/span.js';
import SpanContext from '../src/span_context.js';
import sinon from 'sinon';
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
        assert.equal(span._operationName, 'operation-name');
    });

    it('finish span with custom duration', () => {
        let initialDate = new Date(2011, 9, 1).getTime();
        span._startTime = initialDate;
        let expectedDuration = 1000;
        let finishDate = initialDate + expectedDuration;

        span.finish(finishDate);

        assert.equal(span._duration, expectedDuration);
        assert.equal(reporter.spans.length, 1);
        assert.equal(reporter.spans[0], span);
    });

    it('finish span twice throws exception', () => {
        expect(() => {span.finish(); span.finish();}).to.throw('You can only call finish() on a span once.');
    });

    it('set debug and sampling version through sampling priority', () => {
        span._setSamplingPriority(3);

        assert.isOk(span.context().isDebug());
        assert.isOk(span.context().isSampled());
    });

    it('unset sampling on span', () => {
        span._setSamplingPriority(0);

        assert.isNotOk(span.context().isSampled());
    });

    it('add tags', () => {
        let keyValuePairs = {
            numberTag: 7,
            stringTag: 'string',
            booleanTag: true,
        };
        span.addTags(keyValuePairs);
        span.addTags({numberTag: 8});

        // test to make sure consecutive calls with same key does not
        // overwrite the first key.
        let count = 0;
        for(let i = 0; i < span._tags.length; i++) {
            if (span._tags[i].key === 'numberTag') {
                count += 1;
            }
        }

        assert.isOk(span._tags.length, 4);
        assert.equal(count, 2);
    });

    it('add logs with timestamp, and event', () => {
        let timestamp = new Date(2016, 8, 12).getTime();
        let event = 'some messgae';
        span.log({ 'event': event }, timestamp);

        assert.equal(span._logs.length, 1);
        assert.equal(span._logs[0].timestamp, timestamp);
        assert.equal(span._logs[0].fields[0].value, event);
    });

    it('add logs with paylaod', () => {
        let payload = {a: 1};
        span.log({payload});

        assert.equal(span._logs.length, 1);
        assert.equal(JSON.stringify(span._logs[0].fields[0].value), JSON.stringify(payload));
    });

    it('add logs with event, but without timestamp', () => {
        let expectedTimestamp = new Date(2016, 8, 12).getTime();
        // mock global clock
        let clock = sinon.useFakeTimers(expectedTimestamp);
        let event = 'some messgae';
        span.log({ event });

        assert.equal(span._logs.length, 1);
        assert.equal(span._logs[0].timestamp, expectedTimestamp * 1000); // to micros
        assert.equal(span._logs[0].fields[0].value, event);
        clock.restore();
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

    describe('setTag', () => {
        it('should set a tag, and return a span', () => {
            var newSpan = span.setTag('key', 'value');
            assert.isOk(newSpan instanceof Span);
            assert.isOk(_.isEqual(span._tags[0], {'key': 'key', 'value': 'value'}));
        });
    })

    // TODO(oibe) need tests for standard tags, and handlers
});


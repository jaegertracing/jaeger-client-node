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
import {assert, expect} from 'chai';
import ConstSampler from '../src/samplers/const_sampler.js';
import ProbabilisticSampler from '../src/samplers/probabilistic_sampler';
import * as constants from '../src/constants.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import JaegerTestUtils from '../src/test_util';
import MockLogger from './lib/mock_logger';
import * as opentracing from 'opentracing';
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
            new ConstSampler(true),
            { logger: new MockLogger() }
        );

        spanContext = SpanContext.withBinaryIds(
            Utils.encodeInt64(1),
            Utils.encodeInt64(2),
            Utils.encodeInt64(3),
            constants.SAMPLED_MASK
        );

        span = new Span(
            tracer,
            'op-name',
            spanContext,
            tracer.now()
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
        assert.equal(span.operationName, 'operation-name');
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

    it('finish span twice logs error', () => {
        span.finish();
        span.finish();
        let spanInfo = `operation=${span.operationName},context=${span.context().toString()}`;
        assert.equal(tracer._logger._errorMsgs[0], `${spanInfo}#You can only call finish() on a span once.`);
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

    it('add logs with payload', () => {
        let payload = {a: 1};
        span.log({payload});

        assert.equal(span._logs.length, 1);
        assert.equal(JSON.stringify(span._logs[0].fields[0].value), JSON.stringify(payload));
    });

    it('add logs with event, but without timestamp', () => {
        let expectedTimestamp = 123.456;
        // mock global clock
        let clock = sinon.useFakeTimers(expectedTimestamp);
        let event = 'some messgae';
        span.log({ event });

        assert.equal(span._logs.length, 1);
        assert.equal(span._logs[0].timestamp, expectedTimestamp);
        assert.equal(span._logs[0].fields[0].value, event);
        clock.restore();
    });

    it ('set and retrieve baggage correctly', () => {
        let key = 'some-key';
        let value = 'some-value';

        let spy = sinon.spy(span._baggageSetter, 'setBaggage');
        span.setBaggageItem(key, value);
        assert.equal(value, span.getBaggageItem(key));
        assert(spy.calledOnce);
        assert(spy.calledWith(span, key, value));
    });

    it ('inherit baggage from parent', () => {
        let key = 'some-key';
        let value = 'some-value';

        span.setBaggageItem(key, value);
        let child = tracer.startSpan('child', { childOf: span.context() });
        assert.equal(value, child.getBaggageItem(key));
    });

    it ('normalized key correctly', () => {
        let unnormalizedKey = 'SOME_KEY';
        let key = span._normalizeBaggageKey(unnormalizedKey);

        assert.equal(key, 'some-key');
        assert.isOk(unnormalizedKey in Span._getBaggageHeaderCache());
    });

    describe('adaptive sampling tests for span', () => {
        let options = [
            { desc: 'sampled: ', sampling: true, reportedSpans: 1 },
            { desc: 'unsampled: ', sampling: false, reportedSpans: 0}
        ];
        _.each(options, (o) => {
            it (o.desc + 'should save tags, and logs on an unsampled span incase it later becomes sampled', () => {
                let reporter = new InMemoryReporter();
                let tracer = new Tracer(
                    'test-service-name',
                    reporter,
                    new ConstSampler(false),
                    { logger: new MockLogger() }
                );
                let span = tracer.startSpan('initially-unsampled-span');
                span.setTag('tagKeyOne', 'tagValueOne');
                span.addTags({
                    'tagKeyTwo': 'tagValueTwo'
                });
                span.log({'logkeyOne': 'logValueOne'});

                tracer._sampler = new ConstSampler(o.sampling);
                span.setOperationName('sampled-span');
                span.finish();

                assert.deepEqual(span._tags[0], {key: 'tagKeyOne', value: 'tagValueOne'});
                assert.deepEqual(span._tags[1], {key: 'tagKeyTwo', value: 'tagValueTwo'});
                assert.deepEqual(span._logs[0].fields[0], {key: 'logkeyOne', value: 'logValueOne'});
                assert.equal(reporter.spans.length, o.reportedSpans);
            });
        });

        describe('span sampling finalizer', () => {
            it ('should trigger when it inherits a sampling decision', () => {
                assert.equal(span.context().samplingFinalized, false, 'Span created in before each is not finalized');

                let childSpan = tracer.startSpan('child-span', {childOf: span});
                assert.isOk(span.context().samplingFinalized);
                assert.isOk(childSpan.context().samplingFinalized);
            });

            it ('should trigger when it sets the sampling priority', () => {
                // Span created in before each is not finalized.
                assert.equal(span.context().samplingFinalized, false);

                span.setTag(opentracing.Tags.SAMPLING_PRIORITY, 1);
                assert.isOk(span.context().samplingFinalized);

                let unsampledSpan = tracer.startSpan('usampled-span');
                unsampledSpan.setTag(opentracing.Tags.SAMPLING_PRIORITY, -1);
                assert.isOk(unsampledSpan.context().samplingFinalized);
            });

            it ('should trigger on a finish()-ed span', () => {
                // Span created in before each is not finalized.
                assert.equal(span.context().samplingFinalized, false);

                span.finish();
                assert.isOk(span.context().samplingFinalized);
            });

            it ('should trigger after calling setOperationName', () => {
                // Span created in before each is not finalized.
                assert.equal(span.context().samplingFinalized, false);

                span.setOperationName('fry');
                assert.isOk(span.context().samplingFinalized);
            });

            it ('should trigger when its context is injected into headers', () => {
                // Span created in before each is not finalized.
                assert.equal(span.context().samplingFinalized, false);

                let headers = {};
                tracer.inject(span.context(), opentracing.FORMAT_HTTP_HEADERS, headers);

                assert.isOk(span.context().samplingFinalized);
            });
        });

        it ('isWriteable returns true if not finalized, or the span is sampled', () => {
            tracer = new Tracer(
                'test-service-name',
                new InMemoryReporter(),
                new ConstSampler(false),
                { logger: new MockLogger() }
            );
            let unFinalizedSpan = tracer.startSpan('unFinalizedSpan');
            assert.equal(unFinalizedSpan.context().samplingFinalized, false);
            assert.isOk(unFinalizedSpan._isWriteable());

            tracer._sampler = new ConstSampler(true);
            let sampledSpan = tracer.startSpan('sampled-span');

            sampledSpan.finish();  // finalizes the span
            assert.isOk(sampledSpan.context().samplingFinalized);

            assert.isOk(sampledSpan._isWriteable());
        });

        it ('2nd setOperationName should add sampler tags to span, and change operationName', () => {
            let span = tracer.startSpan('fry');

            assert.equal(span.operationName, 'fry');
            assert.isOk(JaegerTestUtils.hasTags(span, {
                'sampler.type': 'const',
                'sampler.param': true
            }));
            tracer._sampler = new ProbabilisticSampler(1.0);
            span.setOperationName('re-sampled-span');

            assert.equal(span.operationName, 're-sampled-span');
            assert.isOk(JaegerTestUtils.hasTags(span, {
                'sampler.type': 'probabilistic',
                'sampler.param': 1
            }));
        });

        it ('2nd setOperationName should not change the sampling tags, but should change the operationName', () => {
            let span = tracer.startSpan('fry');

            span.setOperationName('new-span-one');
            assert.equal(span.operationName, 'new-span-one');

            // update sampler to something will always sample
            tracer._sampler = new ProbabilisticSampler(1.0);

            // The second cal lshould rename the operation name, but
            // not re-sample the span.  This is because finalize was set 
            // in the first 'setOperationName' call.
            span.setOperationName('new-span-two');

            assert.equal(span.operationName, 'new-span-two');
            assert.isOk(JaegerTestUtils.hasTags(span, {
                'sampler.type': 'const',
                'sampler.param': true
            }));
        });
    });

    describe('setTag', () => {
        it('should set a tag, and return a span', () => {
            let newSpan = span.setTag('key', 'value');
            assert.isOk(newSpan instanceof Span);
            assert.isOk(_.isEqual(span._tags[0], {'key': 'key', 'value': 'value'}));
        });
    });

    // TODO(oibe) need tests for standard tags, and handlers
});


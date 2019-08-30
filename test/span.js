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
import { assert, expect } from 'chai';
import { adaptSamplerOrThrow } from '../src/samplers/_adapt_sampler';
import ConstSampler from '../src/samplers/const_sampler';
import ProbabilisticSampler from '../src/samplers/probabilistic_sampler';
import * as constants from '../src/constants';
import InMemoryReporter from '../src/reporters/in_memory_reporter';
import JaegerTestUtils from '../src/test_util';
import MockLogger from './lib/mock_logger';
import * as opentracing from 'opentracing';
import Span from '../src/span';
import SpanContext from '../src/span_context';
import sinon from 'sinon';
import Tracer from '../src/tracer';
import Utils from '../src/util';
import DefaultThrottler from '../src/throttler/default_throttler';
import BaseSamplerV2 from '../src/samplers/v2/base';

function _prepareObjects() {
  let reporter = new InMemoryReporter();
  let tracer = new Tracer('test-service-name', reporter, new ConstSampler(true), {
    logger: new MockLogger(),
  });

  let spanContext = SpanContext.withBinaryIds(
    Utils.encodeInt64(1),
    Utils.encodeInt64(2),
    Utils.encodeInt64(3),
    constants.SAMPLED_MASK
  );

  let span = new Span(tracer, 'op-name', spanContext, tracer.now());
  return { reporter, tracer, span, spanContext };
}

describe('span should', () => {
  var reporter, tracer, span, spanContext;

  beforeEach(() => {
    ({ reporter, tracer, span, spanContext } = _prepareObjects());
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

  it('return this when calling log method', () => {
    const ret = span.log({ event: 'event' });
    assert.equal(ret, span);
  });

  it('set debug and sampling flags through sampling priority via setTag', () => {
    span.setTag(opentracing.Tags.SAMPLING_PRIORITY, 3);

    assert.isTrue(span.context().isDebug());
    assert.isTrue(span.context().isSampled());
    assert.isTrue(
      JaegerTestUtils.hasTags(span, {
        'sampling.priority': 3,
      })
    );
  });

  it('set debug and sampling flags through sampling priority via addTags', () => {
    let tags = {};
    tags[opentracing.Tags.SAMPLING_PRIORITY] = 3;
    span.addTags(tags);

    assert.isTrue(span.context().isDebug());
    assert.isTrue(span.context().isSampled());
    assert.isTrue(
      JaegerTestUtils.hasTags(span, {
        'sampling.priority': 3,
      })
    );
  });

  it('unset sampling on span via sampling priority', () => {
    span.setTag(opentracing.Tags.SAMPLING_PRIORITY, 0);

    assert.isFalse(span.context().isSampled());
  });

  it('add tags', () => {
    let keyValuePairs = {
      numberTag: 7,
      stringTag: 'string',
      booleanTag: true,
    };
    span.addTags(keyValuePairs);
    span.addTags({ numberTag: 8 });

    // test to make sure consecutive calls with same key does not
    // overwrite the first key.
    let count = 0;
    for (let i = 0; i < span._tags.length; i++) {
      if (span._tags[i].key === 'numberTag') {
        count += 1;
      }
    }

    assert.equal(span._tags.length, 4);
    assert.equal(count, 2);
  });

  it('add logs with timestamp, and event', () => {
    let timestamp = new Date(2016, 8, 12).getTime();
    let event = 'some messgae';
    span.log({ event: event }, timestamp);

    assert.equal(span._logs.length, 1);
    assert.equal(span._logs[0].timestamp, timestamp);
    assert.equal(span._logs[0].fields[0].value, event);
  });

  it('add logs with payload', () => {
    let payload = { a: 1 };
    span.log({ payload });

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

  it('set and retrieve baggage correctly', () => {
    let key = 'some-key';
    let value = 'some-value';

    let spy = sinon.spy(span._baggageSetter, 'setBaggage');
    span.setBaggageItem(key, value);
    assert.equal(value, span.getBaggageItem(key));
    assert(spy.calledOnce);
    assert(spy.calledWith(span, key, value));
  });

  it('inherit baggage from parent', () => {
    let key = 'some-key';
    let value = 'some-value';

    span.setBaggageItem(key, value);
    let child = tracer.startSpan('child', { childOf: span.context() });
    assert.equal(value, child.getBaggageItem(key));
  });

  it('normalized key correctly', () => {
    let unnormalizedKey = 'SOME_KEY';
    let key = span._normalizeBaggageKey(unnormalizedKey);

    assert.equal(key, 'some-key');
    assert.isTrue(unnormalizedKey in Span._getBaggageHeaderCache());
  });

  it('not be set to debug via setTag if throttled', () => {
    tracer._debugThrottler = new DefaultThrottler(true);
    span = new Span(tracer, 'op-name', spanContext, tracer.now());

    const prevTagLength = span._tags.length;
    span.setTag(opentracing.Tags.SAMPLING_PRIORITY, 1);
    assert.isTrue(span.context().samplingFinalized);
    assert.isFalse(span.context().isDebug());
    assert.equal(
      prevTagLength,
      span._tags.length,
      'The sampling.priority tag should not be set if throttled'
    );
  });

  it('not be set to debug via addTags if throttled', () => {
    tracer._debugThrottler = new DefaultThrottler(true);
    span = new Span(tracer, 'op-name', spanContext, tracer.now());

    const prevTagLength = span._tags.length;
    const tags = {};
    tags[opentracing.Tags.SAMPLING_PRIORITY] = 1;
    span.addTags(tags);
    assert.isTrue(span.context().samplingFinalized);
    assert.isFalse(span.context().isDebug());
    assert.equal(
      prevTagLength,
      span._tags.length,
      'The sampling.priority tag should not be set if throttled'
    );
  });

  it('ignore sampling.priority tag if span is already debug', () => {
    tracer._debugThrottler = new DefaultThrottler();
    const isAllowedSpy = sinon.spy(tracer._debugThrottler, 'isAllowed');
    span = new Span(tracer, 'op-name', spanContext, tracer.now());

    span.setTag(opentracing.Tags.SAMPLING_PRIORITY, 1);
    assert.isTrue(span.context().samplingFinalized);
    assert.isTrue(span.context().isDebug());
    assert.deepEqual(span._tags[span._tags.length - 1], { key: 'sampling.priority', value: 1 });

    const prevTagLength = span._tags.length;
    span.setTag(opentracing.Tags.SAMPLING_PRIORITY, 1);
    // isAllowed should only be called the first time the sampling.priority tag is set
    sinon.assert.calledOnce(isAllowedSpy);
    assert.equal(prevTagLength, span._tags.length, 'The sampling.priority tag should only be set once');
  });

  describe('setTag', () => {
    it('should set a tag, and return a span', () => {
      let newSpan = span.setTag('key', 'value');
      assert.isTrue(newSpan instanceof Span);
      assert.isTrue(JaegerTestUtils.hasTags(span, { key: 'value' }));
    });
  });

  // TODO(oibe) need tests for standard tags, and handlers
});

describe('sampling finalizer', () => {
  var reporter, tracer, span, spanContext;

  beforeEach(() => {
    ({ reporter, tracer, span, spanContext } = _prepareObjects());
  });

  class RetryableSampler extends BaseSamplerV2 {
    _decision: boolean;
    constructor(decision: boolean) {
      super('RetryableSampler');
      this._decision = decision;
    }
    _tags(): {} {
      return {
        'sampler.type': 'const',
        'sampler.param': this._decision,
      };
    }
    onCreateSpan(span: Span): SamplingDecision {
      return { sample: this._decision, retryable: true, tags: this._tags() };
    }
    onSetOperationName(span: Span, operationName: string): SamplingDecision {
      return { sample: this._decision, retryable: false, tags: this._tags() };
    }
    onSetTag(span: Span, key: string, value: any): SamplingDecision {
      return { sample: this._decision, retryable: true, tags: this._tags() };
    }
  }

  it('should keep the span writeable', () => {
    let tracer = new Tracer('test-service-name', reporter, new RetryableSampler(false));
    let span = tracer.startSpan('initially-unsampled-span');
    assert.isTrue(span._isWriteable(), 'span is writeable when created');
    assert.isFalse(span.context().samplingFinalized, 'span is not finalized when created');
    span.setTag('tagKeyOne', 'tagValueOne');
    span.addTags({
      tagKeyTwo: 'tagValueTwo',
    });
    span.log({ logkeyOne: 'logValueOne' });
    assert.isTrue(span._isWriteable(), 'span is writeable after setting tags');
    assert.isTrue(
      JaegerTestUtils.hasTags(
        span,
        {
          tagKeyOne: 'tagValueOne',
          tagKeyTwo: 'tagValueTwo',
        },
        'matching tags'
      )
    );
    assert.deepEqual(span._logs[0].fields[0], { key: 'logkeyOne', value: 'logValueOne' });
  });

  it('should make span non-writeable when sampler returns retryable=false', () => {
    let tracer = new Tracer('test-service-name', reporter, new RetryableSampler(false));
    let span = tracer.startSpan('initially-unsampled-span');
    assert.isTrue(span._isWriteable(), 'span is writeable when created');
    assert.isFalse(span.context().samplingFinalized, 'span is not finalized when created');
    // note: RetryableSampler returns retryable=false from onSetOperation()
    span.setOperationName('replace-op-name');
    assert.isFalse(span._isWriteable(), 'span is writeable after setting tags');
    assert.isTrue(span.context().samplingFinalized, 'span is not finalized when created');
  });

  it('should share sampling state with children spans', () => {
    let tracer = new Tracer('test-service-name', reporter, new RetryableSampler(false));
    let span = tracer.startSpan('initially-unsampled-span');
    assert.equal(span.context().samplingFinalized, false, 'new unsampled span is not finalized');

    let childSpan = tracer.startSpan('child-span', { childOf: span });
    assert.isFalse(span.context().samplingFinalized);
    assert.isFalse(childSpan.context().samplingFinalized);
  });

  it('should trigger when it sets the sampling priority', () => {
    assert.isFalse(span.context().samplingFinalized, 'manual span is not finalized');

    span.setTag(opentracing.Tags.SAMPLING_PRIORITY, 1);
    assert.isTrue(span.context().samplingFinalized);
    assert.deepEqual(span._tags[span._tags.length - 1], { key: 'sampling.priority', value: 1 });

    const unsampledSpan = tracer.startSpan('unsampled-span');
    const prevTagLength = span._tags.length;
    unsampledSpan.setTag(opentracing.Tags.SAMPLING_PRIORITY, -1);
    assert.isTrue(unsampledSpan.context().samplingFinalized);
    assert.equal(
      prevTagLength,
      span._tags.length,
      'The sampling.priority tag should not be set if span is finalized and not sampled'
    );
  });

  it('should finalize the span sampled with V1 sampler', () => {
    let span = tracer.startSpan('test');
    assert.isTrue(span.context().samplingFinalized);
  });

  it('should not trigger on a finish()-ed span', () => {
    assert.isFalse(span.context().samplingFinalized, 'manual span is not finalized');
    span.finish();
    assert.isFalse(span.context().samplingFinalized, 'finished span may remain unfinalized');
  });

  it('should trigger after calling setOperationName with V1 sampler', () => {
    assert.isFalse(span.context().samplingFinalized, 'manual span is not finalized');
    span.setOperationName('fry');
    assert.isTrue(span.context().samplingFinalized, 'finalized by V1 sampler');
  });

  it('should not trigger when its context is injected into headers', () => {
    assert.isFalse(span.context().samplingFinalized, 'manual span is not finalized');

    let headers = {};
    tracer.inject(span.context(), opentracing.FORMAT_HTTP_HEADERS, headers);

    assert.isFalse(span.context().samplingFinalized, 'remains unfinalized after inject()');
  });

  it('should keep isWriteable=true if span is sampled or not finalized', () => {
    let tracer = new Tracer('test-service-name', reporter, new RetryableSampler(false));
    let span = tracer.startSpan('initially-unsampled-span');
    assert.isFalse(span.context().samplingFinalized, 'not finalized');
    assert.isFalse(span.context().isSampled(), 'not sampled');
    assert.isTrue(span._isWriteable());

    tracer._sampler = adaptSamplerOrThrow(new ConstSampler(true));
    let sampledSpan = tracer.startSpan('sampled-span');
    assert.isTrue(sampledSpan.context().isSampled(), 'sampled');
    assert.isTrue(sampledSpan.context().samplingFinalized, 'finalized');
    assert.isTrue(sampledSpan._isWriteable(), 'writeable');
  });

  it('should allow 2nd setOperationName to change operationName, but not to affect sampling', () => {
    let span = tracer.startSpan('fry');
    assert.equal(span.operationName, 'fry');
    assert.isTrue(span._spanContext.isSampled());
    assert.isTrue(span._spanContext.samplingFinalized);
    assert.isTrue(
      JaegerTestUtils.hasTags(span, {
        'sampler.type': 'const',
        'sampler.param': true,
      })
    );
    tracer._sampler = adaptSamplerOrThrow(new ProbabilisticSampler(1.0));
    span._tags = []; // since we don't de-dupe tags, JaegerTestUtils.hasTags() below fails
    span.setOperationName('re-sampled-span');
    assert.equal(span.operationName, 're-sampled-span');
    assert.equal(0, span._tags.length);
  });
});

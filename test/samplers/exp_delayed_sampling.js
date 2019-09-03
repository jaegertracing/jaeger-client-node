// @flow
// Copyright (c) 2019 Uber Technologies, Inc.
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

import { assert } from 'chai';
import * as opentracing from 'opentracing';
import Span from '../../src/span';
import Utils from '../../src/util';
import ConstSampler from '../../src/samplers/const_sampler';
import TagEqualsSampler from '../../src/samplers/experimental/tag_equals_sampler';
import PrioritySampler from '../../src/samplers/experimental/priority_sampler';
import InMemoryReporter from '../../src/reporters/in_memory_reporter';
import Tracer from '../../src/tracer';

describe('delayed sampling', () => {
  describe('with PrioritySampler and TagSampler', () => {
    const tagSampler = new TagEqualsSampler('theWho', [
      { tagValue: 'Bender', firehose: false },
      { tagValue: 'Leela', firehose: true },
    ]);
    const constSampler = new ConstSampler(false);
    const priSampler = new PrioritySampler([tagSampler, constSampler]);
    const reporter = new InMemoryReporter();
    const tracer = new Tracer('test-service-name', reporter, priSampler);

    beforeEach(() => {});

    it('should not sample or finalize new span without tags', () => {
      let span = tracer.startSpan('opName');
      assert.isFalse(span._spanContext.isSampled(), 'sampled');
      assert.isFalse(span._spanContext.samplingFinalized, 'finalized');
    });

    it('should sample and finalize created span with tag', () => {
      let span = tracer.startSpan('opName', { tags: { theWho: 'Bender' } });
      assert.isTrue(span._spanContext.isSampled(), 'sampled');
      assert.isTrue(span._spanContext.samplingFinalized, 'finalized');
    });

    [{ who: 'Bender', firehose: false }, { who: 'Leela', firehose: true }].forEach(t => {
      it(`should sample and finalize span after setTag "${t.who}" and set firehose=${t.firehose}`, () => {
        let span = tracer.startSpan('opName');
        assert.isFalse(span._spanContext.isSampled(), 'sampled');
        assert.isFalse(span._spanContext.samplingFinalized, 'finalized');
        span.setTag('theWho', t.who);
        assert.isTrue(span._spanContext.isSampled(), 'sampled');
        assert.isTrue(span._spanContext.samplingFinalized, 'finalized');
        assert.equal(t.firehose, span._spanContext.isFirehose(), 'finalized');
      });
    });

    it('should not sample or finalize span after starting a child span', () => {
      let span = tracer.startSpan('opName');
      let span2 = tracer.startSpan('opName2', { childOf: span.context() });
      assert.isFalse(span._spanContext.isSampled(), 'sampled');
      assert.isFalse(span._spanContext.samplingFinalized, 'finalized');
    });

    it('should not sample or finalize span after serializing context', () => {
      let span = tracer.startSpan('opName');
      let carrier = {};
      tracer.inject(span.context(), opentracing.FORMAT_TEXT_MAP, carrier);
      assert.isOk(carrier);
      assert.isFalse(span._spanContext.isSampled(), 'sampled');
      assert.isFalse(span._spanContext.samplingFinalized, 'finalized');
    });
  });
});

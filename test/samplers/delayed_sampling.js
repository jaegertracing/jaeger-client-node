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
import { SAMPLER_API_V2 } from '../../src/samplers/constants';
import Span from '../../src/span';
import Utils from '../../src/util';
import ConstSampler from '../../src/samplers/const_sampler';
import { adaptSamplerOrThrow } from '../../src/samplers/_adapt_sampler';
import InMemoryReporter from '../../src/reporters/in_memory_reporter';
import Tracer from '../../src/tracer';

describe('delayed sampling', () => {
  declare type Matcher = {
    tagValue: string,
    // can add more flags here, like firehose
  };

  class TagEqualsSampler implements Sampler {
    apiVersion = SAMPLER_API_V2;

    _tagKey: string;
    _matchers: { [string]: Matcher };
    _undecided: SamplingDecision;

    constructor(tagKey: string, matchers: Array<Matcher>) {
      this._tagKey = tagKey;
      this._matchers = {};
      matchers.forEach(m => {
        this._matchers[m.tagValue] = m;
      });
      this._undecided = { sample: false, retryable: true, tags: null };
    }

    _findTag(tags: Array<Tag>): ?Tag {
      for (let i = 0; i < tags.length; i++) {
        if (tags[i].key === this._tagKey) {
          return tags[i];
        }
      }
      return null;
    }

    _createOutTags(tagValue: string): { [string]: string } {
      return {
        'sampler.type': 'TagEqualsSampler',
        'sampler.param': tagValue,
      };
    }

    _decide(tagValue: any): SamplingDecision {
      const match: ?Matcher = this._matchers[tagValue];
      if (match) {
        return { sample: true, retryable: false, tags: this._createOutTags(match.tagValue) };
      }
      return this._undecided;
    }

    onCreateSpan(span: Span): SamplingDecision {
      const tag: ?Tag = this._findTag(span.getTags());
      if (tag) {
        return this._decide(tag.value);
      }
      return this._undecided;
    }

    onSetOperationName(span: Span, operationName: string): SamplingDecision {
      return this.onCreateSpan(span);
    }

    onSetTag(span: Span, key: string, value: any): SamplingDecision {
      if (key === this._tagKey) {
        return this._decide(value);
      }
      return this._undecided;
    }

    toString(): string {
      return 'TagEqualsSampler';
    }

    close(callback: ?Function): void {
      if (callback) {
        callback();
      }
    }
  }

  /**
   * PrioritySamplerState keeps the state of all underlying samplers, specifically
   * whether each of them has previously returned retryable=false, in which case
   * those samplers are no longer invoked on future sampling calls.
   */
  class PrioritySamplerState {
    samplerFired: Array<boolean>;

    constructor(numDelegateSamplers: number) {
      this.samplerFired = Array(numDelegateSamplers);
      // cannot use array.fill() in Node 0.10
      for (let i = 0; i < numDelegateSamplers; i++) {
        this.samplerFired[i] = false;
      }
    }
  }

  /**
   * PrioritySampler contains a list of samplers that it interrogates in order.
   * Sampling methods return as soon as one of the samplers returns sample=true.
   * The retryable state for each underlying sampler is stored in the extended context
   * and once retryable=false is returned by one of the delegates it will never be
   * called against.
   *
   * TODO: since sampling state is shared across all spans of the trace, the execution
   *       of the sampler should probably only happen on the local-root span.
   */
  class PrioritySampler implements Sampler {
    apiVersion = SAMPLER_API_V2;

    _delegates: Array<Sampler>;

    constructor(samplers: Array<Sampler | LegacySamplerV1>) {
      this._delegates = samplers.map(s => adaptSamplerOrThrow(s));
    }

    _getOrCreateState(span: Span): PrioritySamplerState {
      const store = span.context()._samplingState.extendedState();
      const stateKey = 'PrioritySampler'; // TODO ideally should be uniqueName() per BaseSamplerB2
      let state: ?PrioritySamplerState = store[stateKey];
      if (!state) {
        state = new PrioritySamplerState(this._delegates.length);
        store[stateKey] = state;
      }
      return state;
    }

    _trySampling(span: Span, fn: Function): SamplingDecision {
      const state = this._getOrCreateState(span);
      let retryable = false;
      for (let i = 0; i < this._delegates.length; i++) {
        if (state.samplerFired[i]) {
          continue;
        }
        const d = fn(this._delegates[i]);
        retryable = retryable || d.retryable;
        if (!d.retryable) {
          state.samplerFired[i] = true;
        }
        if (d.sample) {
          return d; // TODO do we want to alter out tags?
        }
      }
      return { sample: false, retryable: retryable, tags: null };
    }

    onCreateSpan(span: Span): SamplingDecision {
      return this._trySampling(span, function(delegate: Sampler): SamplingDecision {
        return delegate.onCreateSpan(span);
      });
    }

    onSetOperationName(span: Span, operationName: string): SamplingDecision {
      return this._trySampling(span, function(delegate: Sampler): SamplingDecision {
        return delegate.onSetOperationName(span, operationName);
      });
    }

    onSetTag(span: Span, key: string, value: any): SamplingDecision {
      return this._trySampling(span, function(delegate: Sampler): SamplingDecision {
        return delegate.onSetTag(span, key, value);
      });
    }

    toString(): string {
      return 'DelegatingSampler';
    }

    close(callback: ?() => void): void {
      const countdownCallback = Utils.countdownCallback(this._delegates.length, callback);
      this._delegates.forEach(r => r.close(countdownCallback));
    }
  }

  describe('with PrioritySampler and TagSampler', () => {
    const tagSampler = new TagEqualsSampler('theWho', [{ tagValue: 'Bender' }, { tagValue: 'Leela' }]);
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

    it('should sample and finalize span after setTag', () => {
      let span = tracer.startSpan('opName');
      assert.isFalse(span._spanContext.isSampled(), 'sampled');
      assert.isFalse(span._spanContext.samplingFinalized, 'finalized');
      span.setTag('theWho', 'Leela');
      assert.isTrue(span._spanContext.isSampled(), 'sampled');
      assert.isTrue(span._spanContext.samplingFinalized, 'finalized');
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

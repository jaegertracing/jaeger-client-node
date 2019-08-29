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
import { SAMPLER_API_V2 } from '../../src/samplers/constants';
import Span from '../../src/span';

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

  declare type PrioritySamplerState = {
    samplerFired: Array<boolean>,
  };

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

    constructor(samplers: Array<Sampler>) {
      this._delegates = samplers;
    }

    _getState(span: Span): PrioritySamplerState {
      const store = span.context()._samplingState.extendedState();
      const stateKey = 'DelegatingSampler'; // TODO ideally should be uniqueName() per BaseSamplerB2
      let state: ?PrioritySamplerState = store[stateKey];
      if (!state) {
        state = {
          samplerFired: Array(this._delegates.length).fill(false),
        };
        store[stateKey] = state;
      }
      return state;
    }

    onCreateSpan(span: Span): SamplingDecision {
      const state = this._getState(span);
      let retryable = false;
      for (let i = 0; i < this._delegates.length; i++) {
        if (state.samplerFired[i]) {
          continue;
        }
        const d = this._delegates[i].onCreateSpan(span);
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
      return 'DelegatingSampler';
    }

    close(callback: ?Function): void {
      this._lateBindingSampler.close(() => this._defaultEagerSampler.close(callback));
    }
  }

  it('', () => {});
});

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

import { adaptSamplerOrThrow } from '../_adapt_sampler';
import BaseSamplerV2 from '../v2/base';
import Span from '../../span';
import Utils from '../../util';

/**
 * PrioritySamplerState keeps the state of all underlying samplers, specifically
 * whether each of them has previously returned retryable=false, in which case
 * those samplers are no longer invoked on future sampling calls.
 */
export class PrioritySamplerState {
  samplerFired: Array<boolean>;

  constructor(numDelegateSamplers: number) {
    this.samplerFired = Array(numDelegateSamplers);
    // TODO: for some reason Babel does not translate array.fill() to polyfil that works w/ Node 0.10
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
 */
export default class PrioritySampler extends BaseSamplerV2 {
  _delegates: Array<Sampler>;

  constructor(samplers: Array<Sampler | LegacySamplerV1>) {
    super('PrioritySampler');
    this._delegates = samplers.map(s => adaptSamplerOrThrow(s));
  }

  _getOrCreateState(span: Span): PrioritySamplerState {
    const store = span.context()._samplingState.extendedState();
    const stateKey = this.uniqueName();
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

  close(callback: ?() => void): void {
    const countdownCallback = Utils.countdownCallback(this._delegates.length, callback);
    this._delegates.forEach(r => r.close(countdownCallback));
  }
}

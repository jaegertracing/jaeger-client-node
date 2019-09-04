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

declare type Matcher = {
  tagValue: string,
  firehose: boolean,
};

export default class TagEqualsSampler extends BaseSamplerV2 {
  _tagKey: string;
  _matchers: { [string]: Matcher };
  _undecided: SamplingDecision;

  constructor(tagKey: string, matchers: Array<Matcher>) {
    super('TagEqualsSampler');
    this._tagKey = tagKey;
    this._matchers = {};
    matchers.forEach(m => {
      this._matchers[m.tagValue] = m;
    });
    this._undecided = { sample: false, retryable: true, tags: null };
  }

  /**
   * Creates the sampler from a JSON configuration of the following form:
   * <code>
   *   {
   *     key: 'taKey',
   *     values: {
   *       'tagValue1': {
   *         firehose: true,
   *       },
   *       'tagValue1: {
   *         firehose: false,
   *       },
   *     },
   *   }
   * </code>
   * @param {JSON} strategy
   */
  static fromStrategy(strategy: any): TagEqualsSampler {
    let key = strategy.key;
    let matchers: Array<Matcher> = [];
    Object.keys(strategy.values).forEach(v => {
      matchers.push({
        tagValue: v,
        firehose: Boolean(strategy.values[v].firehose),
      });
    });
    return new TagEqualsSampler(key, matchers);
  }

  _createOutTags(tagValue: string): { [string]: string } {
    return {
      'sampler.type': 'TagEqualsSampler',
      'sampler.param': tagValue,
    };
  }

  _decide(span: Span, tagValue: any): SamplingDecision {
    const match: ?Matcher = this._matchers[tagValue];
    if (match) {
      if (match.firehose) {
        span._spanContext._setFirehose(true);
      }
      return { sample: true, retryable: false, tags: this._createOutTags(match.tagValue) };
    }
    return this._undecided;
  }

  onCreateSpan(span: Span): SamplingDecision {
    // onCreateSpan is called on a brand new span that has no tags yet, so nothing to do here.
    return this._undecided;
  }

  onSetOperationName(span: Span, operationName: string): SamplingDecision {
    // this sampler is not sensitive to operationName, so nothing to do here.
    return this._undecided;
  }

  onSetTag(span: Span, key: string, value: any): SamplingDecision {
    if (key === this._tagKey) {
      return this._decide(span, value);
    }
    return this._undecided;
  }
}

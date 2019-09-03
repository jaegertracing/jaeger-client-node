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
    const tag: ?Tag = this._findTag(span.getTags());
    if (tag) {
      return this._decide(span, tag.value);
    }
    return this._undecided;
  }

  onSetOperationName(span: Span, operationName: string): SamplingDecision {
    return this.onCreateSpan(span);
  }

  onSetTag(span: Span, key: string, value: any): SamplingDecision {
    if (key === this._tagKey) {
      return this._decide(span, value);
    }
    return this._undecided;
  }
}
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

import { SAMPLER_API_V2 } from './constants';
import Span from '../span';
import BaseSamplerV2 from './v2/base';

export function adaptSampler(sampler: any): ?Sampler {
  if (!sampler) {
    return null;
  }
  if (sampler.apiVersion === SAMPLER_API_V2) {
    // already v2 API compatible
    return sampler;
  }
  if (!sampler.apiVersion) {
    // v1 legacy sampler
    return new LegacySamplerV1Adapter(sampler);
  }
  return null;
}

export function adaptSamplerOrThrow(sampler: any): Sampler {
  const s = adaptSampler(sampler);
  if (!s) {
    throw new Error(`Unrecognized sampler: ${sampler}`);
  }
  return s;
}

/**
 * Convenience base class for simple samplers that implement isSampled() function
 * that is not sensitive to its arguments.
 */
export default class LegacySamplerV1Base extends BaseSamplerV2 {
  constructor(name: string) {
    super(name);
  }

  isSampled(operationName: string, outTags: {}): boolean {
    throw new Error('Subclass must override isSampled()');
  }

  onCreateSpan(span: Span): SamplingDecision {
    const outTags = {};
    const isSampled = this.isSampled(span.operationName, outTags);
    return { sample: isSampled, retryable: false, tags: outTags };
  }

  onSetOperationName(span: Span, operationName: string): SamplingDecision {
    const outTags = {};
    const isSampled = this.isSampled(span.operationName, outTags);
    return { sample: isSampled, retryable: false, tags: outTags };
  }

  onSetTag(span: Span, key: string, value: any): SamplingDecision {
    return { sample: false, retryable: true, tags: null };
  }
}

/**
 * Transforms legacy v1 sampler into V2.
 * Primarily intended for simple samplers that are not sensitive to
 * things like operation names or tags and make a decision only once.
 *
 * However, to keep compatible with existing behavior, onCreateSpan and onSetTag
 * return retryable decision, because previously that's how tracer was behaving,
 * where as onSetOperation() returns retryable=false, since that is what the tracer
 * used to do.
 */
class LegacySamplerV1Adapter extends LegacySamplerV1Base {
  apiVersion = SAMPLER_API_V2;
  _delegate: LegacySamplerV1;

  constructor(delegate: LegacySamplerV1) {
    super(delegate.name());
    this._delegate = delegate;
  }

  isSampled(operationName: string, outTags: {}) {
    return this._delegate.isSampled(operationName, outTags);
  }

  toString(): string {
    return this._delegate.toString();
  }

  close(callback: ?Function) {
    this._delegate.close(callback);
  }
}

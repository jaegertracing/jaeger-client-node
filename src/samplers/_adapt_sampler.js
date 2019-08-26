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

function adaptSampler(sampler: any): ?Sampler {
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

export default adaptSampler;

class LegacySamplerV1Adapter extends BaseSamplerV2 {
  _wrapped: LegacySamplerV1;

  constructor(wrapped: LegacySamplerV1) {
    super(`SamplerV1Adapter(${wrapped.name()})`);
    this._wrapped = wrapped;
  }

  onCreateSpan(span: Span): SamplingDecision {
    const outTags = {};
    const isSampled = this._wrapped.isSampled(span.operationName, outTags);
    // TODO not sure if retryable: false is correct here; depends on the sampler
    return { sample: isSampled, retryable: false, tags: outTags };
  }

  onSetOperationName(span: Span, operationName: string): SamplingDecision {
    const outTags = {};
    const isSampled = this._wrapped.isSampled(span.operationName, outTags);
    return { sample: isSampled, retryable: true, tags: outTags };
  }

  close(callback: ?Function) {
    this._wrapped.close(callback);
  }
}

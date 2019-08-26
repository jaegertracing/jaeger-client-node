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

import getInstanceId from './get_instance_id';
import { SAMPLER_API_V2 } from './constants';
import Span from '../span';
import Utils from '../util';
import BaseSamplerV2 from './v2/base';

type AdaptSamplerFn = {
  (sampler: any): ?Sampler,
  orThrow: (sampler: any) => Sampler,
};

function adaptSamplerFn(sampler: any): ?Sampler {
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

function adaptSamplerOrThrow(sampler: any): Sampler {
  const s = adaptSampler(sampler);
  if (!s) {
    throw new Error(`Unrecognized sampler: ${sampler}`);
  }
  return s;
}

adaptSamplerFn.orThrow = adaptSamplerOrThrow;
const adaptSampler: AdaptSamplerFn = adaptSamplerFn;
export default adaptSampler;

class LegacySamplerV1Adapter extends BaseSamplerV2 {
  _adaptee: LegacySamplerV1;

  constructor(instance: LegacySamplerV1) {
    super(`SamplerV1Adapter(${instance.name()})`);
    this._adaptee = instance;
  }

  onCreateSpan(span: Span): SamplingDecision {
    const samplingState = span._spanContext._samplingState;
    if (samplingState.isFinal()) {
      return { sample: false, retryable: false, tags: null };
    }
    if (!samplingState.isLocalRootSpan(span._spanContext)) {
      // this is not the local root span, therefore we should attempt to
      // finalize the sample decision (finalizing will be ignored if something
      // has indicated the sampler state cannot be finalized).
      samplingState.setIsFinal(true);
    } else if (!samplingState.isSampled()) {
      const tags = {};
      const isSampled = this._adaptee.isSampled(span.operationName, tags);
      if (isSampled) {
        samplingState.setIsSampled(true);
        const tagsArr = Utils.convertObjectToTags(tags);
        for (let i = 0; i < tagsArr.length; i++) {
          span._setTag(tagsArr[i].key, tagsArr[i].value);
        }
      }
      return { sample: isSampled, retryable: false, tags: null };
    }
    return { sample: false, retryable: false, tags: null };
  }

  onSetOperationName(span: Span, operationName: string): SamplingDecision {
    const samplingState = span._spanContext._samplingState;
    if (
      samplingState.isFinal() ||
      !samplingState.isLocalRootSpan(span._spanContext) ||
      samplingState.isDebug()
    ) {
      return { sample: false, retryable: false, tags: null };
    }
    const tags = {};
    const isSampled = this._adaptee.isSampled(span.operationName, tags);
    // TODO: For now, this is only additive, it should be updated to only take
    // action if the sampling has changed and to remove existing sampled tags
    // if there are any.
    if (isSampled) {
      samplingState.setIsSampled(true);
      const tagsArr = Utils.convertObjectToTags(tags);
      for (let i = 0; i < tagsArr.length; i++) {
        span._setTag(tagsArr[i].key, tagsArr[i].value);
      }
    }
    samplingState.setIsFinal(true);
    return { sample: isSampled, retryable: false, tags: null };
  }

  close(callback: ?Function) {
    this._adaptee.close(callback);
  }
}

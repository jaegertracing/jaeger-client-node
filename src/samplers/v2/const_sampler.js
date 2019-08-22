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

import getInstanceId from '../get_instance_id';
import { SAMPLER_API_V2 } from '../constants.js';
import * as constants from '../../constants.js';
import Span from '../../span';

export default class ConstSamplerV2 implements Sampler {
  apiVersion = SAMPLER_API_V2;
  _decision: boolean;
  _extendedStateNamespace: string;

  constructor(decision: boolean) {
    this._decision = Boolean(decision);
    this._extendedStateNamespace = getInstanceId(this.name());
  }

  name() {
    return 'ConstSampler';
  }

  extendedStateNamespace() {
    return this._extendedStateNamespace;
  }

  toString() {
    return `${this.name()}(version=2, ${this._decision ? 'always' : 'never'})`;
  }

  get decision() {
    return this._decision;
  }

  onCreateSpan(span: Span) {
    const ctx = span._spanContext;
    if (this._decision && !ctx.samplingFinalized && !ctx.isSampled() && span._isLocalRootSpan()) {
      ctx._setIsSampled(true);
      span._setTag(constants.SAMPLER_TYPE_TAG_KEY, constants.SAMPLER_TYPE_CONST);
      span._setTag(constants.SAMPLER_PARAM_TAG_KEY, this._decision);
    }
  }

  onSetOperationName(span: Span, operationName: string) {
    span._spanContext.finalizeSampling();
  }

  onSetTag(span: Span) {}

  close(callback: ?Function): void {
    if (callback) {
      callback();
    }
  }
}

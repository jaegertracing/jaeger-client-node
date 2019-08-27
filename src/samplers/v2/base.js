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

import { SAMPLER_API_V2 } from '../constants.js';
import Span from '../../span';

let _instanceId = 0;

export default class BaseSamplerV2 implements Sampler {
  apiVersion = SAMPLER_API_V2;
  _name: string;
  _uniqueName: string;
  _cachedDecision: SamplingDecision;

  constructor(name: string) {
    this._name = name;
    this._uniqueName = BaseSamplerV2._getInstanceId(name);
    this._cachedDecision = { sample: false, retryable: false, tags: null };
  }

  static _getInstanceId(name: string) {
    return `${name}[${_instanceId++}]`;
  }

  name() {
    return this._name;
  }

  uniqueName() {
    return this._uniqueName;
  }

  onCreateSpan(span: Span): SamplingDecision {
    throw new Error(`${this.name()} does not implement onCreateSpan`);
  }

  onSetOperationName(span: Span, operationName: string): SamplingDecision {
    return this._cachedDecision;
  }

  onSetTag(span: Span, key: string, value: any): SamplingDecision {
    return this._cachedDecision;
  }

  close(callback: ?Function): void {
    if (callback) {
      callback();
    }
  }
}

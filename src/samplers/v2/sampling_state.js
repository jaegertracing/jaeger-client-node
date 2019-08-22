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

import { DEBUG_MASK, FIREHOSE_MASK, SAMPLED_MASK } from '../../constants';
import SpanContext from '../../span_context';

export const WARN_NOT_FINALIZABLE = 'This sampling state is not finalizable.';
export const WARN_SHOULD_NOT_ENABLE_FINALIZABLE = 'Finalizable can only be changed to false';
export const WARN_CANNOT_REVERT_FINALIZABLE = 'Setting finalizable to false cannot be reverted';
export const WARN_CANNOT_REVERT_FINAL = 'The final state cannot be reverted.';

export default class SamplingState {
  _extendedState: { [string]: any } = {};
  _flags: number = 0;
  _final: boolean = false;
  _finalizable: boolean = true;
  _localRootSpanIdStr: ?string;

  constructor(localRootSpanIdStr: ?string) {
    this._localRootSpanIdStr = localRootSpanIdStr;
  }

  isLocalRootSpan(context: SpanContext) {
    return this._localRootSpanIdStr === context.spanIdStr;
  }

  extendedState() {
    return this._extendedState;
  }

  localRootSpanId() {
    return this._localRootSpanIdStr;
  }

  isFinalizable() {
    return this._finalizable;
  }

  setIsFinalizable(value: false): ?string {
    if (value) {
      if (!this._finalizable) {
        return WARN_CANNOT_REVERT_FINALIZABLE;
      }
      return WARN_SHOULD_NOT_ENABLE_FINALIZABLE;
    }
    this._finalizable = false;
    this._final = false;
  }

  isFinal() {
    return this._final;
  }

  setIsFinal(value: boolean): ?string {
    if (!this._finalizable) {
      return WARN_NOT_FINALIZABLE;
    }
    if (!value && this._final) {
      return WARN_CANNOT_REVERT_FINAL;
    }
    this._final = value;
  }

  isSampled() {
    return Boolean(this._flags & SAMPLED_MASK);
  }

  setIsSampled(enable: boolean) {
    this._toggleFlag(SAMPLED_MASK, enable);
  }

  isDebug() {
    return Boolean(this._flags & DEBUG_MASK);
  }

  setIsDebug(enable: boolean) {
    this._toggleFlag(DEBUG_MASK, enable);
  }

  isFirehose() {
    return Boolean(this._flags & FIREHOSE_MASK);
  }

  setIsFirehose(enable: boolean) {
    this._toggleFlag(FIREHOSE_MASK, enable);
  }

  flags() {
    return this._flags;
  }

  setFlags(flags: number) {
    this._flags = flags;
  }

  _toggleFlag(mask: number, enable: boolean) {
    if (enable) {
      this._flags |= mask;
    } else {
      this._flags &= ~mask;
    }
  }
}

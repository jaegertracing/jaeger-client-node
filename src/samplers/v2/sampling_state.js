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

export default class SamplingState {
  // samplers may store their individual states in this map
  _extendedState: { [string]: any } = {};

  // shared Flags from span context
  _flags: number = 0;

  /**
   * When state is not final, sampling will be retried on other write operations,
   * and spans will remain writable.
   *
   * This field exists to help distinguish between when a span can have a properly
   * correlated operation name -> sampling rate mapping, and when it cannot.
   * Adaptive sampling uses the operation name of a span to correlate it with
   * a sampling rate.  If an operation name is set on a span after the span's creation
   * then adaptive sampling cannot associate the operation name with the proper sampling rate.
   * In order to correct this we allow a span to be written to, so that we can re-sample
   * it in the case that an operation name is set after span creation. Situations
   * where a span context's sampling decision is finalized include:
   * - it has inherited the sampling decision from its parent
   * - its debug flag is set via the sampling.priority tag
   * - it is finish()-ed
   * - setOperationName is called
   * - it is used as a parent for another span
   * - its context is serialized using injectors
   */
  _final: boolean = false;

  // Span ID of the local root span, i.e. the first span in this process for this trace.
  _localRootSpanIdStr: ?string;

  constructor(localRootSpanIdStr: ?string) {
    this._localRootSpanIdStr = localRootSpanIdStr;
  }

  // checks if another span context has the same Span ID as the local root span
  isLocalRootSpan(context: SpanContext) {
    return this._localRootSpanIdStr === context.spanIdStr;
  }

  localRootSpanId(): ?string {
    return this._localRootSpanIdStr;
  }

  extendedState() {
    return this._extendedState;
  }

  isFinal() {
    return this._final;
  }

  setFinal(value: boolean) {
    this._final = value;
  }

  isSampled() {
    return Boolean(this._flags & SAMPLED_MASK);
  }

  setSampled(enable: boolean) {
    this._toggleFlag(SAMPLED_MASK, enable);
  }

  isDebug() {
    return Boolean(this._flags & DEBUG_MASK);
  }

  setDebug(enable: boolean) {
    this._toggleFlag(DEBUG_MASK, enable);
  }

  isFirehose() {
    return Boolean(this._flags & FIREHOSE_MASK);
  }

  setFirehose(enable: boolean) {
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

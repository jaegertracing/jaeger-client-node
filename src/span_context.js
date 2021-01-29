// @flow
// Copyright (c) 2016 Uber Technologies, Inc.
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

import * as constants from './constants';
import SamplingState from './samplers/v2/sampling_state';
import Utils from './util';
import Span from './span';

export default class SpanContext {
  _traceId: any;
  _spanId: any;
  _parentId: any;
  _traceIdStr: ?string;
  _spanIdStr: ?string;
  _parentIdStr: ?string;
  _baggage: any;
  _debugId: ?string;
  _samplingState: SamplingState;
  _remote: boolean; // indicates that span context represents a remote parent

  constructor(
    traceId: any,
    spanId: any,
    parentId: any,
    traceIdStr: ?string,
    spanIdStr: ?string,
    parentIdStr: ?string,
    baggage: any = {},
    debugId: ?string = '',
    samplingState: ?SamplingState
  ) {
    this._traceId = traceId;
    this._spanId = spanId;
    this._parentId = parentId || null;
    this._traceIdStr = traceIdStr;
    this._spanIdStr = spanIdStr;
    this._parentIdStr = parentIdStr;
    this._baggage = baggage;
    this._debugId = debugId;
    this._samplingState = samplingState || new SamplingState(this.spanIdStr);
    this._remote = false;
  }

  get traceId(): any {
    if (this._traceId == null && this._traceIdStr != null) {
      this._traceId = Utils.newBufferFromHex(this._traceIdStr);
    }
    return this._traceId;
  }

  get spanId(): any {
    if (this._spanId == null && this._spanIdStr != null) {
      this._spanId = Utils.encodeInt64(this._spanIdStr);
    }
    return this._spanId;
  }

  get parentId(): any {
    if (this._parentId == null && this._parentIdStr != null) {
      this._parentId = Utils.encodeInt64(this._parentIdStr);
    }
    return this._parentId;
  }

  get traceIdStr(): ?string {
    if (this._traceIdStr == null && this._traceId != null) {
      this._traceIdStr = this._traceId.toString('hex');
    }
    return this._traceIdStr;
  }

  get spanIdStr(): ?string {
    if (this._spanIdStr == null && this._spanId != null) {
      this._spanIdStr = this._spanId.toString('hex');
    }
    return this._spanIdStr;
  }
  
  get parentIdStr(): ?string {
    if (this._parentIdStr == null && this._parentId != null) {
      this._parentIdStr = this._parentId.toString('hex');
    }
    return this._parentIdStr;
  }

  get flags(): number {
    return this._samplingState.flags();
  }

  get baggage(): any {
    return this._baggage;
  }

  get debugId(): ?string {
    return this._debugId;
  }

  get samplingFinalized(): boolean {
    return this._samplingState.isFinal();
  }

  set traceId(traceId: Buffer): void {
    this._traceId = traceId;
    this._traceIdStr = null;
  }

  set spanId(spanId: Buffer): void {
    this._spanId = spanId;
    this._spanIdStr = null;
  }

  set parentId(parentId: Buffer | null): void {
    this._parentId = parentId;
    this._parentIdStr = null;
  }

  set flags(flags: number): void {
    this._samplingState.setFlags(flags);
  }

  _setSampled(value: boolean) {
    this._samplingState.setSampled(value);
  }

  _setDebug(value: boolean) {
    this._samplingState.setDebug(value);
  }

  _setFirehose(value: boolean) {
    this._samplingState.setFirehose(value);
  }

  _setRemote(value: boolean) {
    this._remote = value;
  }

  set baggage(baggage: any): void {
    this._baggage = baggage;
  }

  set debugId(debugId: ?string): void {
    this._debugId = debugId;
  }

  get isValid(): boolean {
    return Boolean((this._traceId || this._traceIdStr) && (this._spanId || this._spanIdStr));
  }

  finalizeSampling() {
    return this._samplingState.setFinal(true);
  }

  isRemote(): boolean {
    return this._remote;
  }

  isDebugIDContainerOnly(): boolean {
    return !this.isValid && Boolean(this._debugId);
  }

  /**
   * @return {boolean} - returns whether or not this span context was sampled.
   **/
  isSampled(): boolean {
    return this._samplingState.isSampled();
  }

  /**
   * @return {boolean} - returns whether or not this span context has a debug flag set.
   **/
  isDebug(): boolean {
    return this._samplingState.isDebug();
  }

  isFirehose(): boolean {
    return this._samplingState.isFirehose();
  }

  withBaggageItem(key: string, value: string): SpanContext {
    let newBaggage = Utils.clone(this._baggage);
    newBaggage[key] = value;
    return new SpanContext(
      this._traceId,
      this._spanId,
      this._parentId,
      this._traceIdStr,
      this._spanIdStr,
      this._parentIdStr,
      newBaggage,
      this._debugId,
      this._samplingState
    );
  }

  _makeChildContext(childId: any) {
    const idIsStr = typeof childId === 'string';
    const _childId = idIsStr ? null : childId;
    const _childIdStr = idIsStr ? childId : null;
    return new SpanContext(
      this._traceId, // traceId
      _childId, // spanId
      this._spanId, // parentId
      this._traceIdStr, // traceIdStr
      _childIdStr, // spanIdStr
      this._spanIdStr, // parentIdStr
      this._baggage, // baggage
      this._debugId, // debugID
      this._samplingState // samplingState
    );
  }

  /**
   * @return {string} - returns trace ID as string or "" if null
   */
  toTraceId(): string {
    return this.traceIdStr || "";
  }

  /**
   * @return {string} - returns span ID as string or "" if null
   */
  toSpanId(): string {
    return this.spanIdStr || "";
  }

  /**
   * @return {string} - returns a string version of this span context.
   **/
  toString(): string {
    return `${String(this.traceIdStr)}:${String(this.spanIdStr)}:${String(
      this.parentIdStr || 0
    )}:${this._samplingState.flags().toString(16)}`;
  }

  /**
   * @param {string} serializedString - a serialized span context.
   * @return {SpanContext} - returns a span context represented by the serializedString.
   **/
  static fromString(serializedString: string): any {
    let headers: any = serializedString.split(':');
    if (headers.length !== 4) {
      return null;
    }

    // Note: Number type in JS cannot represent the full range of 64bit unsigned ints,
    // so using parseInt() on strings representing 64bit hex numbers only returns
    // an approximation of the actual value. Fortunately, we do not depend on the
    // returned value, we are only using it to validate that the string is
    // a valid hex number (which is faster than doing it manually).  We cannot use
    // Int64(numberValue).toBuffer() because it throws exceptions on bad strings.
    let approxTraceId = parseInt(headers[0], 16);
    let NaNDetected =
      isNaN(approxTraceId) ||
      approxTraceId === 0 ||
      isNaN(parseInt(headers[1], 16)) ||
      isNaN(parseInt(headers[2], 16)) ||
      isNaN(parseInt(headers[3], 16));

    if (NaNDetected) {
      return null;
    }

    let parentId = null;
    if (headers[2] !== '0') {
      parentId = headers[2];
    }

    return SpanContext.withStringIds(headers[0], headers[1], parentId, parseInt(headers[3], 16));
  }

  static withBinaryIds(
    traceId: any,
    spanId: any,
    parentId: any,
    flags: number,
    baggage: any = {},
    debugId: ?string = ''
  ): SpanContext {
    const ctx = new SpanContext(
      traceId,
      spanId,
      parentId,
      null, // traceIdStr: string,
      null, // spanIdStr: string,
      null, // parentIdStr: string,
      baggage,
      debugId
    );
    ctx.flags = flags;
    return ctx;
  }

  static withStringIds(
    traceIdStr: any,
    spanIdStr: any,
    parentIdStr: any,
    flags: number,
    baggage: any = {},
    debugId: ?string = ''
  ): SpanContext {
    const ctx = new SpanContext(
      null, // traceId,
      null, // spanId,
      null, // parentId,
      Utils.padTraceIdStrWithZeros(traceIdStr),
      Utils.padTraceIdStrWithZeros(spanIdStr),
      Utils.padTraceIdStrWithZeros(parentIdStr),
      baggage,
      debugId
    );
    ctx.flags = flags;
    return ctx;
  }
}

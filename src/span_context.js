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

import * as constants from './constants.js';
import Utils from './util.js';

export default class SpanContext {
    _traceId: any;
    _spanId: any;
    _parentId: any;
    _traceIdStr: ?string;
    _spanIdStr: ?string;
    _parentIdStr: ?string;
    _flags: number;
    _baggage: any;
    _debugId: ?string;
    /**
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
     * */
    _samplingFinalized: boolean;

    constructor(traceId: any,
                spanId: any,
                parentId: any,
                traceIdStr: ?string,
                spanIdStr: ?string,
                parentIdStr: ?string,
                flags: number = 0,
                baggage: any = {},
                debugId: ?string = '',
                samplingFinalized: boolean = false) {
        this._traceId = traceId;
        this._spanId = spanId;
        this._parentId = parentId;
        this._traceIdStr = traceIdStr;
        this._spanIdStr = spanIdStr;
        this._parentIdStr = parentIdStr;
        this._flags = flags;
        this._baggage = baggage;
        this._debugId = debugId;
        this._samplingFinalized = samplingFinalized;
    }

    get traceId(): any {
        if (this._traceId == null && this._traceIdStr != null) {
            this._traceId = Utils.encodeInt64(this._traceIdStr);
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
            this._traceIdStr = Utils.removeLeadingZeros(this._traceId.toString('hex'));
        }
        return this._traceIdStr;
    }

    get spanIdStr(): ?string {
        if (this._spanIdStr == null && this._spanId != null) {
            this._spanIdStr = Utils.removeLeadingZeros(this._spanId.toString('hex'));
        }
        return this._spanIdStr;
    }

    get parentIdStr(): ?string {
        if (this._parentIdStr == null && this._parentId != null) {
            this._parentIdStr = Utils.removeLeadingZeros(this._parentId.toString('hex'));
        }
        return this._parentIdStr;
    }

    get flags(): number {
        return this._flags;
    }

    get baggage(): any {
        return this._baggage;
    }

    get debugId(): ?string {
        return this._debugId;
    }

    get samplingFinalized(): boolean {
        return this._samplingFinalized;
    }

    set traceId(traceId: Buffer): void {
        this._traceId = traceId;
        this._traceIdStr = null;
    }

    set spanId(spanId: Buffer): void {
        this._spanId = spanId;
        this._spanIdStr = null;
    }

    set parentId(parentId: Buffer): void {
        this._parentId = parentId;
        this._parentIdStr = null;
    }

    set flags(flags: number): void {
        this._flags = flags;
    }

    set baggage(baggage: any): void {
        this._baggage = baggage;
    }

    set debugId(debugId: ?string): void {
        this._debugId = debugId;
    }

    get isValid(): boolean {
        return !!((this._traceId || this._traceIdStr) && (this._spanId || this._spanIdStr));
    }

    finalizeSampling(): void {
        this._samplingFinalized = true;
    }

    isDebugIDContainerOnly(): boolean {
        return !this.isValid && this._debugId !== '';
    }

    /**
     * @return {boolean} - returns whether or not this span context was sampled.
     **/
    isSampled(): boolean {
        return (this.flags & constants.SAMPLED_MASK) === constants.SAMPLED_MASK;
    }

    /**
     * @return {boolean} - returns whether or not this span context has a debug flag set.
     **/
    isDebug(): boolean {
        return (this.flags & constants.DEBUG_MASK) === constants.DEBUG_MASK;
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
            this._flags,
            newBaggage,
            this._debugId,
            this._samplingFinalized
            );
    }

    /**
     * @return {string} - returns a string version of this span context.
     **/
    toString(): string {
        return [
            this.traceIdStr,
            this.spanIdStr,
            this.parentIdStr || "0",
            this._flags.toString(16)
        ].join(':');
    }

    /**
     * @param {string} serializedString - a serialized span context.
     * @return {SpanContext} - returns a span context represented by the serializedString.
     **/
    static fromString(serializedString: string): any {
        let headers:  any = serializedString.split(':');
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
        let NaNDetected = (isNaN(approxTraceId, 16) || approxTraceId === 0) ||
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

        return SpanContext.withStringIds(
            headers[0],
            headers[1],
            parentId,
            parseInt(headers[3], 16)
        );
    }

    static withBinaryIds(traceId: any,
                         spanId: any,
                         parentId: any,
                         flags: number,
                         baggage: any = {},
                         debugId: ?string = '') : SpanContext {
        return new SpanContext(
            traceId,
            spanId,
            parentId,
            null, // traceIdStr: string,
            null, // spanIdStr: string,
            null, // parentIdStr: string,
            flags,
            baggage,
            debugId
        );
    }

    static withStringIds(traceIdStr: any,
                         spanIdStr: any,
                         parentIdStr: any,
                         flags: number,
                         baggage: any = {},
                         debugId: ?string = '') : SpanContext {
        return new SpanContext(
            null, // traceId,
            null, // spanId,
            null, // parentId,
            traceIdStr,
            spanIdStr,
            parentIdStr,
            flags,
            baggage,
            debugId
        );
    }
}

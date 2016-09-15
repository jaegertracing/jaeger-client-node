// @flow
// Copyright (c) 2016 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import * as constants from './constants.js';
import Utils from './util.js';
import Long from 'long';

export default class SpanContext {
    _traceId: Long;
    _spanId: Long;
    _parentId: Long;
    _flags: number;
    _baggage: any;

    constructor(traceId: Long,
                spanId: Long,
                parentId: Long,
                flags: number,
                baggage: any = {}) {
        this._traceId = traceId;
        this._spanId = spanId;
        this._parentId = parentId;
        this._flags = flags;
        this._baggage = baggage;
    }

    get traceId(): Long {
        return this._traceId;
    }


    get spanId(): Long {
        return this._spanId;
    }

    get parentId(): Long {
        return this._parentId;
    }

    get flags(): number {
        return this._flags;
    }

    get baggage(): any {
        return this._baggage;
    }

    set traceId(traceId: Long): void {
        this._traceId = traceId;
    }

    set spanId(spanId: Long): void {
        this._spanId = spanId;
    }

    set parentId(parentId: Long): void {
        this._parentId = parentId;
    }

    set flags(flags: number): void {
        this._flags = flags;
    }

    set baggage(baggage: any): void {
        this._baggage = baggage;
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

    /**
     * @return {string} - returns a string version of this span context.
     **/
    toString(): string {
        var parentId = this._parentId ? this._parentId.toString(16) : '0';

        return [
            Utils.removeLeadingZeros(this._traceId.toString(16)),
            Utils.removeLeadingZeros(this._spanId.toString(16)),
            Utils.removeLeadingZeros(parentId),
            this._flags.toString(16)
        ].join(':');
    }

    withBaggageItem(key: string, value: string): SpanContext {
        let newBaggage = Utils.clone(this._baggage);
        newBaggage[key] = value;
        return new SpanContext(this._traceId, this._spanId, this._parentId, this._flags, newBaggage);
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

        let traceId = Utils.isParsableHex64(headers[0]);
        let spanId = Utils.isParsableHex64(headers[1]);
        let parentId = Utils.isParsableHex64(headers[2]);
        let flags = parseInt(headers[3], 16);
        let NaNDetected = ((isNaN(traceId) || traceId.toNumber() === 0) ||
                          isNaN(spanId)   ||
                          isNaN(parentId) ||
                          isNaN(flags));

        if (NaNDetected) {
            return null;
        }

        // The collector expects null instead of zero.
        if (parentId.toNumber() === 0) {
            parentId = null;
        }

        return new SpanContext(
            traceId,
            spanId,
            parentId,
            flags
        );
    }
}

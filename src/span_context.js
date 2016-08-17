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

import Int64 from 'node-int64';
import Utils from './util.js';

let SAMPLED_MASK = 0x1;
let DEBUG_MASK = 0x2;

export default class SpanContext {
    _traceId: any;
    _spanId: any;
    _parentId: any;
    _flags: number;
    _baggage: any;
    _baggageHeaderCache: any;

    constructor(traceId: any,
                spanId: any,
                parentId: any,
                flags: number,
                baggage: any = {}) {
        this._traceId = traceId;
        this._spanId = spanId;
        this._parentId = parentId;
        this._flags = flags;
        this._baggage = baggage;
    }

    get traceId(): any {
        return this._traceId;
    }

    get spanId(): any {
        return this._spanId;
    }

    get parentId(): any {
        return this._parentId;
    }

    get flags(): number {
        return this._flags;
    }

    get baggage(): any {
        return this._baggage;
    }

    static getBaggageHeaderCache() {
        if (!this._baggageHeaderCache) {
            this._baggageHeaderCache = {};
        }

        return this._baggageHeaderCache;
    }

    /**
     * Returns a normalize key.
     *
     * @param {string} key - The key to be normalized for a particular baggage value.
     * @return {string} - The normalized key (lower cased and underscores replaced, along with dashes.)
     **/
    // todo(oibe) moved to span in newest opentracing version
    _normalizeBaggageKey(key: string) {
        let baggageHeaderCache = this.constructor.getBaggageHeaderCache();
        if (key in baggageHeaderCache) {
            return baggageHeaderCache[key];
        }

        // This stackoverflow claims this approach is slower than regex
        // http://stackoverflow.com/questions/1144783/replacing-all-occurrences-of-a-string-in-javascript
        let normalizedKey: string = key.toLowerCase().split('_').join('-');

        if (Object.keys(baggageHeaderCache).length < 100) {
            baggageHeaderCache[key] = normalizedKey;
        }

        return normalizedKey;
    }

    /**
     * Sets a baggage value with an associated key.
     *
     * @param {string} key - The baggage key.
     * @param {string} value - The baggage value.
     **/
    // todo(oibe) moved to span in newest opentracing version
    setBaggageItem(key: string, value: string): void {
        let normalizedKey = this._normalizeBaggageKey(key);
        this._baggage[normalizedKey] = value;
    }

    /**
     * Gets a baggage value with an associated key.
     *
     * @param {string} key - The baggage key.
     * @return {string} value - The baggage value.
     **/
    // todo(oibe) moved to span in newest opentracing version
    getBaggageItem(key: string): string {
        let normalizedKey = this._normalizeBaggageKey(key);
        return this._baggage[normalizedKey];
    }

    /**
     * @return {boolean} - returns whether or not this span context was sampled.
     **/
    IsSampled(): boolean {
        return (this.flags & SAMPLED_MASK) === SAMPLED_MASK;
    }

    /**
     * @return {boolean} - returns whether or not this span context has a debug flag set.
     **/
    IsDebug(): boolean {
        return (this.flags & DEBUG_MASK) === DEBUG_MASK;
    }

    /**
     * @return {string} - returns a string version of this span context.
     **/
    toString(): string {
        var parentId = this._parentId ? this._parentId.toString('hex') : '0';

        return [
            Utils.removeLeadingZeros(this._traceId.toString('hex')),
            Utils.removeLeadingZeros(this._spanId.toString('hex')),
            Utils.removeLeadingZeros(parentId),
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

        // todo(oibe) is it better to throw an exception here, or return null?
        let traceId: any = Utils.encodeInt64(headers[0]);
        let spanId: any = Utils.encodeInt64(headers[1]);
        let parentId: any = headers[2];
        let flags: number = parseInt(headers[3], 16);

        let convertedParentId: any = null;
        if (!(parentId === '0')) {
            convertedParentId = Utils.encodeInt64(parentId);
        }

        return new SpanContext(
            traceId,
            spanId,
            convertedParentId,
            flags
        );
    }
}

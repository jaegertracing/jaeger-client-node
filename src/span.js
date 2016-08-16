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
import * as thrift from './thrift.js';
import Utils from './util.js';
import SpanContext from './span_context.js';

export default class Span {
    _tracer: any;
    _name: string;
    _spanContext: SpanContext;
    _start: number;
    _duration: number;
    _firstInProcess: boolean;
    _isClient: boolean;
    _peer: Endpoint;
    _annotations: Array<Annotation>;
    _binaryAnnotations: Array<BinaryAnnotation>;
    _baggageHeaderCache: any;

    constructor(tracer: any,
                name: string,
                spanContext: SpanContext,
                start: number = Utils.getTimestampMicros(),
                firstInProcess: boolean = false,
                annotations: Array<Annotation> = [],
                binaryAnnotations: Array<BinaryAnnotation> = []
    ) {
        this._tracer = tracer;
        this._name = name;
        this._spanContext = spanContext;
        this._start = start;
        this._firstInProcess = firstInProcess;

        // logs
        this._annotations = annotations;

        // tags
        this._binaryAnnotations = binaryAnnotations;
    }

    static _getBaggageHeaderCache() {
        if (!this._baggageHeaderCache) {
            // $FlowIgnore - flow doesn't seem to like how statics are declared
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
    _normalizeBaggageKey(key: string) {
       // TODO(oibe) should be moved to span in newest opentracing version
        let baggageHeaderCache = this.constructor._getBaggageHeaderCache();
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
    setBaggageItem(key: string, value: string): void {
        // TODO(oibe) should be moved to span in newest opentracing version
        let normalizedKey = this._normalizeBaggageKey(key);
        this._spanContext.withBaggageItem(normalizedKey, value);
    }

    /**
     * Gets a baggage value with an associated key.
     *
     * @param {string} key - The baggage key.
     * @return {string} value - The baggage value.
     **/
    getBaggageItem(key: string): string {
        // TODO(oibe) should be moved to span in newest opentracing version
        let normalizedKey = this._normalizeBaggageKey(key);
        return this._spanContext.baggage[normalizedKey];
    }

    /**
     * Returns the span context that represents this span.
     *
     * @return {SpanContext} - Returns this span's span context.
     **/
    context(): SpanContext {
        return this._spanContext;
    }

    /**
     * Returns the tracer associated with this span.
        this._duration;
     * @return {Tracer} - returns the tracer associated witht this span.
     **/
    tracer(): any {
        return this._tracer;
    }

    /**
     * Sets the operation name on this given span.
     *
     * @param {string} name - The name to use for setting a span's operation name.
     **/
    setOperationName(name: string): void {
        this._name = name;
    }

    /**
     * Finishes a span which has the effect of reporting it and
     * setting the finishTime on the span.
     *
     * @param {number} finishTime - The time on which this span finished.
     **/
    finish(finishTime: number): void {
        if (this._duration !== undefined) {
            throw 'You can only call finish() on a span once.';
        }

        if (this._spanContext.isSampled()) {
            let endTime = finishTime || Utils.getTimestampMicros();
            this._duration = endTime - this._start;
            this._tracer._report(this);
        }
    }

    /**
     * Adds a set of tags to a span.
     *
     * @param {Object} keyValuePairs - An object with key value pairs
     * that represent tags to be added to this span.
     **/
    addTags(keyValuePairs: any): void {
        if (this._spanContext.isSampled()) {
            for (let key in keyValuePairs) {
                if (keyValuePairs.hasOwnProperty(key)) {
                    let value = keyValuePairs[key];
                    let tag;
                    if (typeof value === 'number' && (Math.floor(value) === value)) {
                        tag = Utils.createIntegerTag(key, value);
                    } else if (typeof value === 'boolean') {
                        tag = Utils.createBooleanTag(key, value);
                    } else {
                        tag = Utils.createStringTag(key, value);
                    }
                    this._binaryAnnotations.push(tag);
                }
            }
        }
    }

    /**
     * Adds a log event, or payload to a span.
     *
     * @param {Object} fields - an object that represents the fields to log.
     * @param {number} [fields.timestamp] - the starting timestamp of a span.
     * @param {string} [fields.event] - a string message to be logged on a span.
     * @param {string} [fields.payload] - an object to be logged on a span as a json string.
     **/
    log(fields: any): void {
        if (this._spanContext.isSampled()) {
            if (!fields.timestamp) {
                fields.timestamp = Utils.getTimestampMicros();
            }

            if (!fields.event && !fields.payload) {
                throw new Error('log must be passed either an event of type string, or a payload of type object');
            }
            let value = fields.event || JSON.stringify(fields.payload);
            let logData = Utils.createLogData(fields.timestamp, value);

            logData.host = this._tracer._host;
            this._annotations.push(logData);
        }
    }

    _setSamplingPriority(priority: number): void {
        if (priority > 0) {
            this._spanContext.flags = this._spanContext.flags | constants.SAMPLED_MASK | constants.DEBUG_MASK;
        } else {
            this._spanContext.flags = this._spanContext.flags & (~constants.SAMPLED_MASK);
        }
    }
}

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
import SpanContext from './span_context.js';
import NullLogger from './logger.js';

export default class Span {
    _tracer: any;
    _operationName: string;
    _spanContext: SpanContext;
    _timestamp: number;
    _logger: any;
    _duration: number;
    _firstInProcess: boolean;
    _isClient: boolean;
    _peer: Endpoint;
    _logs: Array<LogData>;
    _tags: Array<Tag>;
    static _baggageHeaderCache: any;

    constructor(tracer: any,
                operationName: string,
                spanContext: SpanContext,
                timestamp: number,
                firstInProcess: boolean = false
    ) {
        this._tracer = tracer;
        this._operationName = operationName;
        this._spanContext = spanContext;
        this._timestamp = timestamp;
        this._logger = tracer._logger;
        this._firstInProcess = firstInProcess;
        this._logs = [];
        this._tags = [];
    }

    static _getBaggageHeaderCache() {
        if (!Span._baggageHeaderCache) {
            Span._baggageHeaderCache = {};
        }

        return Span._baggageHeaderCache;
    }

    /**
     * Returns a normalize key.
     *
     * @param {string} key - The key to be normalized for a particular baggage value.
     * @return {string} - The normalized key (lower cased and underscores replaced, along with dashes.)
     **/
    _normalizeBaggageKey(key: string) {
        let baggageHeaderCache = Span._getBaggageHeaderCache();
        if (key in baggageHeaderCache) {
            return baggageHeaderCache[key];
        }

        let normalizedKey: string = key.replace(/_/g, '-').toLowerCase();

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
        let normalizedKey = this._normalizeBaggageKey(key);
        this._spanContext = this._spanContext.withBaggageItem(normalizedKey, value);
    }

    /**
     * Gets a baggage value with an associated key.
     *
     * @param {string} key - The baggage key.
     * @return {string} value - The baggage value.
     **/
    getBaggageItem(key: string): string {
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
    setOperationName(operationName: string): void {
        this._operationName = operationName;
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
            this._duration = endTime - this._timestamp;
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
                    this._tags.push({key, value});
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
            if (!fields.event && !fields.payload) {
                this._logger.error('log must be passed either an event of type string, or a payload of type object');
                return;
            }

            if (!fields.timestamp) {
                fields.timestamp = Utils.getTimestampMicros();
            }

            let value = fields.event;
            this._logs.push({
                timestamp: fields.timestamp,
                event: fields.event,
                payload: fields.payload
            });
        }
    }

    _setSamplingPriority(priority: number): void {
        if (priority > 0) {
            this._spanContext.flags = this._spanContext.flags | constants.SAMPLED_MASK | constants.DEBUG_MASK;
        } else {
            this._spanContext.flags = this._spanContext.flags & (~constants.SAMPLED_MASK);
        }
    }

    _toThrift() {
        let tags = [];
        for (let i = 0; i < this._tags.length; i++) {
            let tag = this._tags[i];
            tags.push({
                key: tag.key,
                tagType: 'STRING', // TODO(oibe) support multiple tag types
                vStr: tag.value,
                vDouble: 0,
                vBool: false,
                vInt16: 0,
                vInt32: 0,
                vInt64: 0,
                vBinary: new Buffer(1)
            });
        }

        return {
            traceId : this._spanContext.traceId,
            spanId: this._spanContext.spanId,
            operationName: this._operationName,
            references: [], // TODO(oibe) revist correctness after a spanRef diff is landed.
            flags: this._spanContext.flags,
            startTime: Utils.encodeInt64(this._timestamp),
            duration: Utils.encodeInt64(this._duration),
            tags: tags,
            logs: this._logs
        }
    }
}


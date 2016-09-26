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

import fs from 'fs';
import path from 'path';
import * as constants from './constants.js';
import NullLogger from './logger.js';
import SpanContext from './span_context.js';
import {Tags as opentracing_tags} from 'opentracing';
import {Thrift} from 'thriftrw';
import Utils from './util.js';
import Long from 'long';

export default class Span {
    _tracer: any;
    _operationName: string;
    _spanContext: SpanContext;
    _startTime: number;
    _logger: any;
    _duration: number;
    _firstInProcess: boolean;
    _logs: Array<LogData>;
    _tags: Array<Tag>;
    static emptyBuffer: Buffer = new Buffer(8);
    static _baggageHeaderCache: any;
    static _thrift = new Thrift({
        source: fs.readFileSync(path.join(__dirname, './jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
        allowOptionalArguments: true
    });

    constructor(tracer: any,
                operationName: string,
                spanContext: SpanContext,
                startTime: number,
                firstInProcess: boolean = false
    ) {
        this._tracer = tracer;
        this._operationName = operationName;
        this._spanContext = spanContext;
        this._startTime = startTime;
        this._logger = tracer._logger;
        this._firstInProcess = firstInProcess;
        this._logs = [];
        this._tags = [];
    }

    get firstInProcess(): boolean {
        return this._firstInProcess;
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
     *
     * @return {Span} - returns this span.
     **/
    setBaggageItem(key: string, value: string): Span {
        let normalizedKey = this._normalizeBaggageKey(key);
        this._spanContext = this._spanContext.withBaggageItem(normalizedKey, value);
        return this;
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
     * @return {Span} - returns this span.
     **/
    setOperationName(operationName: string): Span {
        this._operationName = operationName;
        return this;
    }

    /**
     * Finishes a span which has the effect of reporting it and
     * setting the finishTime on the span.
     *
     * @param {number} finishTime - The time on which this span finished.
     **/
    finish(finishTime: ?number): void {
        if (this._duration !== undefined) {
            throw new Error('You can only call finish() on a span once.');
        }

        if (this._spanContext.isSampled()) {
            let endTime = finishTime || Utils.getTimestampMicros();
            this._duration = endTime - this._startTime;
            this._tracer._report(this);
        }
    }

    /**
     * Adds a set of tags to a span.
     *
     * @param {Object} keyValuePairs - An object with key value pairs
     * that represent tags to be added to this span.
     * @return {Span} - returns this span.
     **/
    addTags(keyValuePairs: any): Span {
        if (opentracing_tags.SAMPLING_PRIORITY in keyValuePairs) {
            this._setSamplingPriority(keyValuePairs[opentracing_tags.SAMPLING_PRIORITY]);
            delete keyValuePairs[opentracing_tags.SAMPLING_PRIORITY];
        }

        if (this._spanContext.isSampled()) {
            for (let key in keyValuePairs) {
                if (keyValuePairs.hasOwnProperty(key)) {
                    let value = keyValuePairs[key];
                    this._tags.push({'key': key, 'value': value});
                }
            }
        }
        return this;
    }

    /**
     * Adds a single tag to a span
     *
     * @param {string} key - The key for the tag added to this span.
     * @param {string} value - The value corresponding with the key 
     * for the tag added to this span.
     * @return {Span} - returns this span.
     * */
    setTag(key: string, value: any): Span {
        if (key === opentracing_tags.SAMPLING_PRIORITY) {
            this._setSamplingPriority(value);
            return this;
        }

        if (this._spanContext.isSampled()) {
            this._tags.push({'key': key, 'value': value});
        }
        return this;
    }

    /**
     * Adds a log event, or payload to a span.
     *
     * @param {Object} keyValuePairs - an object that represents the keyValuePairs to log.
     * @param {number} [timestamp] - the starting timestamp of a span.
     * @param {string} [keyValuePairs.event] - a string message to be logged on a span.
     * @param {string} [keyValuePairs.payload] - an object to be logged on a span as a json string.
     **/
    log(keyValuePairs: any, timestamp: ?number): void {
        if (this._spanContext.isSampled()) {
            let tags = [];
            for (let key in keyValuePairs) {
                let value = keyValuePairs[key];
                if (keyValuePairs.hasOwnProperty(key)) {
                    tags.push({'key': key, 'value': value});
                }
            }

            this._logs.push({
                'timestamp': timestamp || Utils.getTimestampMicros(),
                'fields': tags
            });
        }
    }

    /**
     * Logs a event with an optional payload.
     *
     * @param  {string} eventName - string associated with the log record
     * @param  {object} [payload] - arbitrary payload object associated with the
     *         log record.
     */
    logEvent(eventName: string, payload: any): void {
        return this.log({
            event: eventName,
            payload: payload
        });
    }

    _setSamplingPriority(priority: number): void {
        if (priority > 0) {
            this._spanContext.flags = this._spanContext.flags | constants.SAMPLED_MASK | constants.DEBUG_MASK;
        } else {
            this._spanContext.flags = this._spanContext.flags & (~constants.SAMPLED_MASK);
        }
    }

    static _getTagType(tag: Tag): string {
        if (tag.value instanceof Number) {
            return Span._thrift.TagType.DOUBLE;
        } else if (tag.value instanceof Boolean) {
            return Span._thrift.TagType.BOOL;
        } else if (tag.value instanceof Long) { //TODO(oibe) how else to recognize a long?
            return Span._thrift.TagType.LONG;
        } else if (tag.value instanceof Buffer) {
            return Span._thrift.TagType.BUFFER;
        } else {
            return Span._thrift.TagType.STRING;
        }
    }

    static _getThriftTags(initialTags: Array<Tag>): Array<any> {
        let thriftTags = [];
        for (let i = 0; i < initialTags.length; i++) {
            let tag = initialTags[i];

            let key: string = tag.key;
            let vType: string = Span._getTagType(tag);

            let vLong: Buffer = Span.emptyBuffer;
            if (vType === Span._thrift.TagType.LONG) {
                vLong = tag.value;
            }

            let vBinary: Buffer = Span.emptyBuffer;
            if (vType === Span._thrift.TagType.BUFFER) {
                vBinary = tag.value;
            }

            let vBool: boolean = false;
            if (vType === Span._thrift.TagType.BOOL) {
                vBool = tag.value;
            }

            let vDouble: number = 0;
            if (vType === Span._thrift.TagType.DOUBLE) {
                vDouble = tag.value;
            }

            let vStr: string = '';
            if (vType === Span._thrift.TagType.STRING) {
                vStr = tag.value.toString();
            }

            thriftTags.push({
                key: key,
                vType: vType,
                vStr: vStr,
                vDouble: vDouble,
                vBool: vBool,
                vLong: vLong,
                vBinary: vBinary
            });
        }

        return thriftTags;
    }

    _getThriftLogs(): Array<any> {
        let thriftLogs = [];
        for (let i = 0; i < this._logs.length; i++) {
            let log = this._logs[i];
            thriftLogs.push({
                'timestamp': log.timestamp,
                'fields': Span._getThriftTags(log.fields)
            });
        }

        return thriftLogs;
    }

    _toThrift() {
        let tags = Span._getThriftTags(this._tags);
        let logs = this._getThriftLogs();
        let unsigned = true;

        return {
            traceIdLow: this._spanContext.traceId,
            traceIdHigh: Span.emptyBuffer,  // TODO(oibe) implement 128 bit ids
            spanId: this._spanContext.spanId,
            parentSpanId: this._spanContext.parentId || Span.emptyBuffer, //TODO(oibe) how should thrift send null?
            operationName: this._operationName,
            references: [], // TODO(oibe) revist correctness after a spanRef diff is landed.
            flags: this._spanContext.flags,
            startTime: Utils.encodeInt64(this._startTime),
            duration: Utils.encodeInt64(this._duration),
            tags: tags,
            logs: logs
        }
    }
}

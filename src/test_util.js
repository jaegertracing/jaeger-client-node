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

import _ from 'lodash';
import bufferEqual from 'buffer-equal';
import opentracing from 'opentracing';
import Span from './span';
import Utils from './util'; import LocalCounter from './metrics/local/counter';

export default class TestUtils {
    static traceIdEqual(span: Span, traceId: number): boolean {
        var spanTraceId = span.context().traceId
        if (spanTraceId == null && traceId == null) {
            return true;
        }

        return bufferEqual(spanTraceId, Utils.encodeInt64(traceId));
    }

    static spanIdEqual(span: Span, spanId: number): boolean {
        var spanContextId = span.context().spanId
        if (spanContextId == null && spanId == null) {
            return true;
        }

        return bufferEqual(spanContextId, Utils.encodeInt64(spanId));
    }

    static parentIdEqual(span: Span, parentId: number): boolean {
        var spanParentId = span.context().parentId
        if (spanParentId == null && parentId == null) {
            return true;
        }

        return bufferEqual(spanParentId, Utils.encodeInt64(parentId));
    }

    static flagsEqual(span: Span, flags: number): boolean {
        var spanFlagsId = span.context().flags;
        return spanFlagsId === flags;
    }

    static operationNameEqual(span: Span, operationName: string): boolean {
        return span._operationName === operationName;
    }

    static startTimeEqual(span: Span, startTime: number): boolean {
        return span._startTime === startTime;
    }

    static durationEqual(span: Span, duration: number): boolean {
        return span._duration === duration;
    }

    static hasTags(span: Span, tags: any): boolean {
        // TODO(oibe) make this work for duplicate tags
        let expectedTags = {};
        for (let i = 0; i < span._tags.length; i++) {
            let key = span._tags[i].key;
            let value = span._tags[i].value;
            expectedTags[key] = value;
        }

        for (let tag in tags) {
            if (tags.hasOwnProperty(tag) && (!(tag in expectedTags))) {
                return false;
            }
        }

        return true;
    }

    static hasLogs(span: Span, logs: Array<any>): boolean {
        /*
        1.) This method does not work if span logs have nested objects...
        2.)  This is hard to make linear because if an object does not have a guaranteed order
              then I cannot stringify a log, and use it as a key in a hashmap.  So its safer to compare object
              equality with a O(n^2) which is only used for testing.
        */
        for (let i = 0; i < logs.length; i++) {
            let expectedLog = span._logs[i];
            let found = false;
            for (let j = 0; j < span._logs.length; j++) {
                let spanLog = span._logs[j];
                if (_.isEqual(spanLog, expectedLog)) {
                    found = true
                }
            }
            if (!found) {
                return false;
            }
            found = false;
        }

        return true;
    }

    static isClient(span: Span): boolean {
        let tag = {};
        tag[opentracing.Tags.SPAN_KIND] = opentracing.Tags.SPAN_KIND_RPC_CLIENT;
        return TestUtils.hasTags(span, tag);
    }

    static hasBaggage(span: Span, baggage: any): boolean {
        let found = false;
        for (let key in baggage) {
            found = span.getBaggageItem(key);
            if (!found) {
                return false;
            }
        }

        return true;
    }

    static isDebug(span: Span): boolean {
        return span.context().isDebug();
    }

    static isSampled(span: Span): boolean {
        return span.context().isSampled();
    }

    static carrierHasTracerState(carrier: any): boolean {
        let tracerState = carrier['uber-trace-id'];
        return tracerState !== null && tracerState !== undefined;
    }

    static carrierHasBaggage(carrier: any, baggage: any, prefix: string = 'uberctx-') {
        for (let key in baggage) {
            if (baggage.hasOwnProperty(key)) {
                let prefixKey = prefix+key;
                if (!(prefixKey in carrier)) {
                    return false;
                }
            }
        }

        return true;
    }
}

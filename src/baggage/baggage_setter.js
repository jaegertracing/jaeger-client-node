// @flow
// Copyright (c) 2017 Uber Technologies, Inc.
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

import Span from '../span.js';
import SpanContext from '../span_context.js';
import Metrics from '../metrics/metrics.js'

/**
 * BaggageSetter is a class that sets a baggage key:value and the associated
 * logs on a Span.
 */
export default class BaggageSetter {
    _restrictionManager: BaggageRestrictionManager;
    _metrics: Metrics;

    constructor(restrictionManager: BaggageRestrictionManager, metrics: Metrics) {
        this._restrictionManager = restrictionManager;
        this._metrics = metrics;
    }

    /**
     * Sets the baggage key:value on the span and the corresponding logs.
     * A SpanContext is returned with the new baggage key:value set.
     *
     * @param {Span} span - The span to set the baggage on.
     * @param {string} key - The baggage key to set.
     * @param {string} baggageValue - The baggage value to set.
     * @return {SpanContext} - The SpanContext with the baggage set if applicable.
     */
    setBaggage(span: Span, key: string, baggageValue: string): SpanContext {
        let value = baggageValue;
        let truncated = false;
        let prevItem = '';
        let restriction = this._restrictionManager.getRestriction(key);
        if (!restriction.keyAllowed) {
            this._logFields(span, key, value, prevItem, truncated, restriction.keyAllowed);
            this._metrics.baggageUpdateFailure.increment(1);
            return span.context();
        }
        if (value.length > restriction.maxValueLength) {
            truncated = true;
            value = value.substring(0, restriction.maxValueLength);
            this._metrics.baggageTruncate.increment(1);
        }
        prevItem = span.getBaggageItem(key);
        this._logFields(span, key, value, prevItem, truncated, restriction.keyAllowed);
        this._metrics.baggageUpdateSuccess.increment(1);
        return span.context().withBaggageItem(key, value);
    }

    _logFields(span: Span, key: string, value: string, prevItem: string, truncated: boolean, valid: boolean) {
        if (!span.context().isSampled()) {
            return
        }
        let fields: { [key: string]: string } = {
            event: 'baggage',
            key: key,
            value: value,
        };
        if (prevItem) {
            fields.override = 'true';
        }
        if (truncated) {
            fields.truncated = 'true';
        }
        if (!valid) {
            fields.invalid = 'true';
        }
        span.log(fields);
    }
}

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
 * BaggageSetter is a class that sets a valid baggage key:value and the associated
 * logs on a Span.
 */
export default class BaggageSetter {
    /**
     * This flag represents whether the key is a valid baggage key. If valid
     * the baggage key:value will be written to the span.
     */
    _valid: boolean;
    _maxValueLength: number;
    _metrics: Metrics;

    constructor(valid: boolean, maxValueLength: number, metrics: Metrics) {
        this._valid = valid;
        this._maxValueLength = maxValueLength;
        this._metrics = metrics;
    }

    /**
     * Sets the baggage key:value on the span and the corresponding logs.
     * Whether the baggage is set on the span depends on if the key
     * is valid.
     * A SpanContext is returned with the new baggage key:value set
     * if key is valid, else returns the existing SpanContext on the Span.
     *
     * @param {Span} span - The span to set the baggage on.
     * @param {string} key - The baggage key to set.
     * @param {string} value - The baggage value to set.
     * @return {SpanContext} - The SpanContext with the baggage set.
     */
    setBaggage(span: Span, key: string, value: string): SpanContext {
        let truncated = false;
        let prevItem = span.getBaggageItem(key);
        if (!this._valid) {
            this._metrics.baggageUpdateFailure.increment(1);
            this._logFields(span, key, value, prevItem, truncated);
            return span.context();
        }
        if (value.length > this._maxValueLength) {
            truncated = true;
            value = value.substring(0, this._maxValueLength);
            this._metrics.baggageTruncate.increment(1);
        }
        this._logFields(span, key, value, prevItem, truncated);
        this._metrics.baggageUpdateSuccess.increment(1);
        return span.context().withBaggageItem(key, value);
    }

    _logFields(span: Span, key: string, value: string, prevItem: string, truncated: boolean) {
        if (!span.context().isSampled()) {
            return
        }
        let fields: { [key: string]: string } = {
            'event': 'baggage',
            'key': key,
            'value': value,
        };
        if (prevItem) {
            fields['override'] = 'true';
        }
        if (truncated) {
            fields['truncated'] = 'true';
        }
        if (!this._valid) {
            fields['invalid'] = 'true';
        }
        span.log(fields);
    }
}

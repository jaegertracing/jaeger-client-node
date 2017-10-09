// @flow
// Copyright (c) 2017 Uber Technologies, Inc.
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
        let restriction = this._restrictionManager.getRestriction(span.serviceName, key);
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

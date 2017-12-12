'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _span = require('../span.js');

var _span2 = _interopRequireDefault(_span);

var _span_context = require('../span_context.js');

var _span_context2 = _interopRequireDefault(_span_context);

var _metrics = require('../metrics/metrics.js');

var _metrics2 = _interopRequireDefault(_metrics);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * BaggageSetter is a class that sets a baggage key:value and the associated
 * logs on a Span.
 */
var BaggageSetter = function () {
    function BaggageSetter(restrictionManager, metrics) {
        _classCallCheck(this, BaggageSetter);

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


    _createClass(BaggageSetter, [{
        key: 'setBaggage',
        value: function setBaggage(span, key, baggageValue) {
            var value = baggageValue;
            var truncated = false;
            var prevItem = '';
            var restriction = this._restrictionManager.getRestriction(span.serviceName, key);
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
    }, {
        key: '_logFields',
        value: function _logFields(span, key, value, prevItem, truncated, valid) {
            if (!span.context().isSampled()) {
                return;
            }
            var fields = {
                event: 'baggage',
                key: key,
                value: value
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
    }]);

    return BaggageSetter;
}();

exports.default = BaggageSetter;
//# sourceMappingURL=baggage_setter.js.map
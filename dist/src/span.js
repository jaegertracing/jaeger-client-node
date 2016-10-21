'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _constants = require('./constants.js');

var constants = _interopRequireWildcard(_constants);

var _logger = require('./logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _span_context = require('./span_context.js');

var _span_context2 = _interopRequireDefault(_span_context);

var _opentracing = require('opentracing');

var _util = require('./util.js');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Span = function () {
    function Span(tracer, operationName, spanContext, startTime) {
        var firstInProcess = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
        var references = arguments[5];

        _classCallCheck(this, Span);

        this._tracer = tracer;
        this._operationName = operationName;
        this._spanContext = spanContext;
        this._startTime = startTime;
        this._logger = tracer._logger;
        this._firstInProcess = firstInProcess;
        this._references = references;
        this._logs = [];
        this._tags = [];
    }

    _createClass(Span, [{
        key: '_normalizeBaggageKey',


        /**
         * Returns a normalize key.
         *
         * @param {string} key - The key to be normalized for a particular baggage value.
         * @return {string} - The normalized key (lower cased and underscores replaced, along with dashes.)
         **/
        value: function _normalizeBaggageKey(key) {
            var baggageHeaderCache = Span._getBaggageHeaderCache();
            if (key in baggageHeaderCache) {
                return baggageHeaderCache[key];
            }

            var normalizedKey = key.replace(/_/g, '-').toLowerCase();

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

    }, {
        key: 'setBaggageItem',
        value: function setBaggageItem(key, value) {
            var normalizedKey = this._normalizeBaggageKey(key);
            this._spanContext = this._spanContext.withBaggageItem(normalizedKey, value);
            return this;
        }

        /**
         * Gets a baggage value with an associated key.
         *
         * @param {string} key - The baggage key.
         * @return {string} value - The baggage value.
         **/

    }, {
        key: 'getBaggageItem',
        value: function getBaggageItem(key) {
            var normalizedKey = this._normalizeBaggageKey(key);
            return this._spanContext.baggage[normalizedKey];
        }

        /**
         * Returns the span context that represents this span.
         *
         * @return {SpanContext} - Returns this span's span context.
         **/

    }, {
        key: 'context',
        value: function context() {
            return this._spanContext;
        }

        /**
         * Returns the tracer associated with this span.
            this._duration;
         * @return {Tracer} - returns the tracer associated witht this span.
         **/

    }, {
        key: 'tracer',
        value: function tracer() {
            return this._tracer;
        }

        /**
         * Sets the operation name on this given span.
         *
         * @param {string} name - The name to use for setting a span's operation name.
         * @return {Span} - returns this span.
         **/

    }, {
        key: 'setOperationName',
        value: function setOperationName(operationName) {
            this._operationName = operationName;
            return this;
        }

        /**
         * Finishes a span which has the effect of reporting it and
         * setting the finishTime on the span.
         *
         * @param {number} finishTime - The time on which this span finished.
         **/

    }, {
        key: 'finish',
        value: function finish(finishTime) {
            if (this._duration !== undefined) {
                throw new Error('You can only call finish() on a span once.');
            }

            if (this._spanContext.isSampled()) {
                var endTime = finishTime || _util2.default.getTimestampMicros();
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

    }, {
        key: 'addTags',
        value: function addTags(keyValuePairs) {
            if (_opentracing.Tags.SAMPLING_PRIORITY in keyValuePairs) {
                this._setSamplingPriority(keyValuePairs[_opentracing.Tags.SAMPLING_PRIORITY]);
                delete keyValuePairs[_opentracing.Tags.SAMPLING_PRIORITY];
            }

            if (this._spanContext.isSampled()) {
                for (var key in keyValuePairs) {
                    if (keyValuePairs.hasOwnProperty(key)) {
                        var value = keyValuePairs[key];
                        this._tags.push({ 'key': key, 'value': value });
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

    }, {
        key: 'setTag',
        value: function setTag(key, value) {
            if (key === _opentracing.Tags.SAMPLING_PRIORITY) {
                this._setSamplingPriority(value);
                return this;
            }

            if (this._spanContext.isSampled()) {
                this._tags.push({ 'key': key, 'value': value });
            }
            return this;
        }

        /**
         * Adds a log event, or payload to a span.
         *
         * @param {Object} keyValuePairs - an object that represents the keyValuePairs to log.
         * @param {number} [timestamp] - the starting timestamp of a span.
         **/

    }, {
        key: 'log',
        value: function log(keyValuePairs, timestamp) {
            if (this._spanContext.isSampled()) {

                this._logs.push({
                    'timestamp': timestamp || _util2.default.getTimestampMicros(),
                    'fields': _util2.default.convertObjectToTags(keyValuePairs)
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

    }, {
        key: 'logEvent',
        value: function logEvent(eventName, payload) {
            return this.log({
                event: eventName,
                payload: payload
            });
        }
    }, {
        key: '_setSamplingPriority',
        value: function _setSamplingPriority(priority) {
            if (priority > 0) {
                this._spanContext.flags = this._spanContext.flags | constants.SAMPLED_MASK | constants.DEBUG_MASK;
            } else {
                this._spanContext.flags = this._spanContext.flags & ~constants.SAMPLED_MASK;
            }
        }
    }, {
        key: 'firstInProcess',
        get: function get() {
            return this._firstInProcess;
        }
    }], [{
        key: '_getBaggageHeaderCache',
        value: function _getBaggageHeaderCache() {
            if (!Span._baggageHeaderCache) {
                Span._baggageHeaderCache = {};
            }

            return Span._baggageHeaderCache;
        }
    }]);

    return Span;
}();

exports.default = Span;
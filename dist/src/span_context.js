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

var _util = require('./util.js');

var _util2 = _interopRequireDefault(_util);

var _long = require('long');

var _long2 = _interopRequireDefault(_long);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SpanContext = function () {
    function SpanContext(traceId, spanId, parentId, flags) {
        var baggage = arguments.length <= 4 || arguments[4] === undefined ? {} : arguments[4];

        _classCallCheck(this, SpanContext);

        this._traceId = traceId;
        this._spanId = spanId;
        this._parentId = parentId;
        this._flags = flags;
        this._baggage = baggage;
    }

    _createClass(SpanContext, [{
        key: 'isSampled',


        /**
         * @return {boolean} - returns whether or not this span context was sampled.
         **/
        value: function isSampled() {
            return (this.flags & constants.SAMPLED_MASK) === constants.SAMPLED_MASK;
        }

        /**
         * @return {boolean} - returns whether or not this span context has a debug flag set.
         **/

    }, {
        key: 'isDebug',
        value: function isDebug() {
            return (this.flags & constants.DEBUG_MASK) === constants.DEBUG_MASK;
        }

        /**
         * @return {string} - returns a string version of this span context.
         **/

    }, {
        key: 'toString',
        value: function toString() {
            var parentId = this._parentId ? this._parentId.toString(16) : '0';

            return [this._traceId.toString(16), this._spanId.toString(16), parentId, this._flags.toString(16)].join(':');
        }
    }, {
        key: 'withBaggageItem',
        value: function withBaggageItem(key, value) {
            var newBaggage = _util2.default.clone(this._baggage);
            newBaggage[key] = value;
            return new SpanContext(this._traceId, this._spanId, this._parentId, this._flags, newBaggage);
        }

        /**
         * @param {string} serializedString - a serialized span context.
         * @return {SpanContext} - returns a span context represented by the serializedString.
         **/

    }, {
        key: 'traceId',
        get: function get() {
            return this._traceId;
        },
        set: function set(traceId) {
            this._traceId = traceId;
        }
    }, {
        key: 'spanId',
        get: function get() {
            return this._spanId;
        },
        set: function set(spanId) {
            this._spanId = spanId;
        }
    }, {
        key: 'parentId',
        get: function get() {
            return this._parentId;
        },
        set: function set(parentId) {
            this._parentId = parentId;
        }
    }, {
        key: 'flags',
        get: function get() {
            return this._flags;
        },
        set: function set(flags) {
            this._flags = flags;
        }
    }, {
        key: 'baggage',
        get: function get() {
            return this._baggage;
        },
        set: function set(baggage) {
            this._baggage = baggage;
        }
    }], [{
        key: 'fromString',
        value: function fromString(serializedString) {
            var headers = serializedString.split(':');
            if (headers.length !== 4) {
                return null;
            }

            var traceId = _util2.default.parseHex64(headers[0]);
            var spanId = _util2.default.parseHex64(headers[1]);
            var parentId = _util2.default.parseHex64(headers[2]);
            var flags = parseInt(headers[3], 16);
            var NaNDetected = isNaN(traceId) || traceId.toNumber() === 0 || isNaN(spanId) || isNaN(parentId) || isNaN(flags);

            if (NaNDetected) {
                return null;
            }

            // The collector expects null instead of zero.
            if (parentId.low === 0 && parentId.high === 0) {
                parentId = null;
            }

            return new SpanContext(traceId, spanId, parentId, flags);
        }
    }]);

    return SpanContext;
}();

exports.default = SpanContext;
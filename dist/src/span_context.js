'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
// Copyright (c) 2016 Uber Technologies, Inc.
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

var _constants = require('./constants.js');

var constants = _interopRequireWildcard(_constants);

var _util = require('./util.js');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SpanContext = function () {
    function SpanContext(traceId, spanId, parentId, traceIdStr, spanIdStr, parentIdStr) {
        var flags = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : 0;
        var baggage = arguments.length > 7 && arguments[7] !== undefined ? arguments[7] : {};
        var debugId = arguments.length > 8 && arguments[8] !== undefined ? arguments[8] : '';
        var samplingFinalized = arguments.length > 9 && arguments[9] !== undefined ? arguments[9] : false;

        _classCallCheck(this, SpanContext);

        this._traceId = traceId;
        this._spanId = spanId;
        this._parentId = parentId;
        this._traceIdStr = traceIdStr;
        this._spanIdStr = spanIdStr;
        this._parentIdStr = parentIdStr;
        this._flags = flags;
        this._baggage = baggage;
        this._debugId = debugId;
        this._samplingFinalized = samplingFinalized;
    }
    /**
     * This field exists to help distinguish between when a span can have a properly
     * correlated operation name -> sampling rate mapping, and when it cannot.
     * Adaptive sampling uses the operation name of a span to correlate it with
     * a sampling rate.  If an operation name is set on a span after the span's creation
     * then adaptive sampling cannot associate the operation name with the proper sampling rate.
     * In order to correct this we allow a span to be written to, so that we can re-sample
     * it in the case that an operation name is set after span creation. Situations 
     * where a span context's sampling decision is finalized include:
     * - it has inherited the sampling decision from its parent
     * - its debug flag is set via the sampling.priority tag
     * - it is finish()-ed
     * - setOperationName is called
     * - it is used as a parent for another span
     * - its context is serialized using injectors
     * */


    _createClass(SpanContext, [{
        key: 'finalizeSampling',
        value: function finalizeSampling() {
            this._samplingFinalized = true;
        }
    }, {
        key: 'isDebugIDContainerOnly',
        value: function isDebugIDContainerOnly() {
            return !this.isValid && this._debugId !== '';
        }

        /**
         * @return {boolean} - returns whether or not this span context was sampled.
         **/

    }, {
        key: 'isSampled',
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
    }, {
        key: 'withBaggageItem',
        value: function withBaggageItem(key, value) {
            var newBaggage = _util2.default.clone(this._baggage);
            newBaggage[key] = value;
            return new SpanContext(this._traceId, this._spanId, this._parentId, this._traceIdStr, this._spanIdStr, this._parentIdStr, this._flags, newBaggage, this._debugId, this._samplingFinalized);
        }

        /**
         * @return {string} - returns a string version of this span context.
         **/

    }, {
        key: 'toString',
        value: function toString() {
            return [this.traceIdStr, this.spanIdStr, this.parentIdStr || "0", this._flags.toString(16)].join(':');
        }

        /**
         * @param {string} serializedString - a serialized span context.
         * @return {SpanContext} - returns a span context represented by the serializedString.
         **/

    }, {
        key: 'traceId',
        get: function get() {
            if (this._traceId == null && this._traceIdStr != null) {
                this._traceId = _util2.default.encodeInt64(this._traceIdStr);
            }
            return this._traceId;
        },
        set: function set(traceId) {
            this._traceId = traceId;
            this._traceIdStr = null;
        }
    }, {
        key: 'spanId',
        get: function get() {
            if (this._spanId == null && this._spanIdStr != null) {
                this._spanId = _util2.default.encodeInt64(this._spanIdStr);
            }
            return this._spanId;
        },
        set: function set(spanId) {
            this._spanId = spanId;
            this._spanIdStr = null;
        }
    }, {
        key: 'parentId',
        get: function get() {
            if (this._parentId == null && this._parentIdStr != null) {
                this._parentId = _util2.default.encodeInt64(this._parentIdStr);
            }
            return this._parentId;
        },
        set: function set(parentId) {
            this._parentId = parentId;
            this._parentIdStr = null;
        }
    }, {
        key: 'traceIdStr',
        get: function get() {
            if (this._traceIdStr == null && this._traceId != null) {
                this._traceIdStr = _util2.default.removeLeadingZeros(this._traceId.toString('hex'));
            }
            return this._traceIdStr;
        }
    }, {
        key: 'spanIdStr',
        get: function get() {
            if (this._spanIdStr == null && this._spanId != null) {
                this._spanIdStr = _util2.default.removeLeadingZeros(this._spanId.toString('hex'));
            }
            return this._spanIdStr;
        }
    }, {
        key: 'parentIdStr',
        get: function get() {
            if (this._parentIdStr == null && this._parentId != null) {
                this._parentIdStr = _util2.default.removeLeadingZeros(this._parentId.toString('hex'));
            }
            return this._parentIdStr;
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
    }, {
        key: 'debugId',
        get: function get() {
            return this._debugId;
        },
        set: function set(debugId) {
            this._debugId = debugId;
        }
    }, {
        key: 'samplingFinalized',
        get: function get() {
            return this._samplingFinalized;
        }
    }, {
        key: 'isValid',
        get: function get() {
            return !!((this._traceId || this._traceIdStr) && (this._spanId || this._spanIdStr));
        }
    }], [{
        key: 'fromString',
        value: function fromString(serializedString) {
            var headers = serializedString.split(':');
            if (headers.length !== 4) {
                return null;
            }

            // Note: Number type in JS cannot represent the full range of 64bit unsigned ints,
            // so using parseInt() on strings representing 64bit hex numbers only returns
            // an approximation of the actual value. Fortunately, we do not depend on the
            // returned value, we are only using it to validate that the string is
            // a valid hex number (which is faster than doing it manually).  We cannot use
            // Int64(numberValue).toBuffer() because it throws exceptions on bad strings.
            var approxTraceId = parseInt(headers[0], 16);
            var NaNDetected = isNaN(approxTraceId, 16) || approxTraceId === 0 || isNaN(parseInt(headers[1], 16)) || isNaN(parseInt(headers[2], 16)) || isNaN(parseInt(headers[3], 16));

            if (NaNDetected) {
                return null;
            }

            var parentId = null;
            if (headers[2] !== '0') {
                parentId = headers[2];
            }

            return SpanContext.withStringIds(headers[0], headers[1], parentId, parseInt(headers[3], 16));
        }
    }, {
        key: 'withBinaryIds',
        value: function withBinaryIds(traceId, spanId, parentId, flags) {
            var baggage = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
            var debugId = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : '';

            return new SpanContext(traceId, spanId, parentId, null, // traceIdStr: string,
            null, // spanIdStr: string,
            null, // parentIdStr: string,
            flags, baggage, debugId);
        }
    }, {
        key: 'withStringIds',
        value: function withStringIds(traceIdStr, spanIdStr, parentIdStr, flags) {
            var baggage = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
            var debugId = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : '';

            return new SpanContext(null, // traceId,
            null, // spanId,
            null, // parentId,
            traceIdStr, spanIdStr, parentIdStr, flags, baggage, debugId);
        }
    }]);

    return SpanContext;
}();

exports.default = SpanContext;
//# sourceMappingURL=span_context.js.map
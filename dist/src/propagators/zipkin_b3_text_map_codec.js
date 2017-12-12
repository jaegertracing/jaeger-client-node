'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
// Copyright (c) 2017 The Jaeger Authors
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

var _constants = require('../constants.js');

var constants = _interopRequireWildcard(_constants);

var _metrics = require('../metrics/metrics.js');

var _metrics2 = _interopRequireDefault(_metrics);

var _metric_factory = require('../metrics/noop/metric_factory');

var _metric_factory2 = _interopRequireDefault(_metric_factory);

var _span_context = require('../span_context.js');

var _span_context2 = _interopRequireDefault(_span_context);

var _util = require('../util.js');

var _util2 = _interopRequireDefault(_util);

var _baggage = require('../propagators/baggage');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ZIPKIN_PARENTSPAN_HEADER = 'x-b3-parentspanid';
var ZIPKIN_SPAN_HEADER = 'x-b3-spanid';
var ZIPKIN_TRACE_HEADER = 'x-b3-traceid';
var ZIPKIN_SAMPLED_HEADER = 'x-b3-sampled';
var ZIPKIN_FLAGS_HEADER = 'x-b3-flags';

var ZipkinB3TextMapCodec = function () {
    function ZipkinB3TextMapCodec() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, ZipkinB3TextMapCodec);

        this._urlEncoding = !!options.urlEncoding;
        this._baggagePrefix = options.baggagePrefix || constants.TRACER_BAGGAGE_HEADER_PREFIX;
        this._baggagePrefix = this._baggagePrefix.toLowerCase();
        this._metrics = options.metrics || new _metrics2.default(new _metric_factory2.default());
    }

    _createClass(ZipkinB3TextMapCodec, [{
        key: '_encodeValue',
        value: function _encodeValue(value) {
            if (this._urlEncoding) {
                return encodeURIComponent(value);
            }

            return value;
        }
    }, {
        key: '_decodeValue',
        value: function _decodeValue(value) {
            // only use url-decoding if there are meta-characters '%'
            if (this._urlEncoding && value.indexOf('%') > -1) {
                return this._decodeURIValue(value);
            }

            return value;
        }
    }, {
        key: '_isValidZipkinId',
        value: function _isValidZipkinId(value) {
            // Validates a zipkin trace/spanID by attempting to parse it as a
            // string of hex digits. This "validation" is not entirely rigorous,
            // but equivalent to what is performed in the TextMapCodec.
            //
            // Note: due to the way parseInt works, this does not guarantee that
            // the string is composed *entirely* of hex digits.
            //
            // > If parseInt encounters a character that is not a numeral in the
            // > specified radix, it ignores it and all succeeding characters and
            // > returns the integer value parsed up to that point.
            //
            // Note: The Number type in JS cannot represent the full range of 64bit
            // unsigned ints, so using parseInt() on strings representing 64bit hex
            // numbers only returns an approximation of the actual value.
            // Fortunately, we do not depend on the returned value, we are only
            // using it to validate that the string is a valid hex number (which is
            // faster than doing it manually).  We cannot use
            // Int64(numberValue).toBuffer() because it throws exceptions on bad
            // strings.
            if (!value) {
                return true;
            }

            return !isNaN(parseInt(value, 16));
        }
    }, {
        key: '_decodeURIValue',
        value: function _decodeURIValue(value) {
            // unfortunately, decodeURIComponent() can throw 'URIError: URI malformed' on bad strings
            try {
                return decodeURIComponent(value);
            } catch (e) {
                return value;
            }
        }
    }, {
        key: 'extract',
        value: function extract(carrier) {
            var baggage = {};
            var flags = 0;
            var debugId = '';
            var parentId = '';
            var spanId = '';
            var traceId = '';

            for (var key in carrier) {
                if (carrier.hasOwnProperty(key)) {
                    var lowerKey = key.toLowerCase();

                    switch (lowerKey) {
                        case ZIPKIN_PARENTSPAN_HEADER:
                            parentId = this._decodeValue(carrier[ZIPKIN_PARENTSPAN_HEADER]);
                            break;
                        case ZIPKIN_SPAN_HEADER:
                            spanId = this._decodeValue(carrier[ZIPKIN_SPAN_HEADER]);
                            break;
                        case ZIPKIN_TRACE_HEADER:
                            traceId = this._decodeValue(carrier[ZIPKIN_TRACE_HEADER]);
                            break;
                        case ZIPKIN_SAMPLED_HEADER:
                            flags = flags | constants.SAMPLED_MASK;
                            break;
                        case ZIPKIN_FLAGS_HEADER:
                            // Per https://github.com/openzipkin/b3-propagation
                            //   "Debug is encoded as X-B3-Flags: 1"
                            // and
                            //   "Debug implies Sampled."
                            if (carrier[key] === '1') {
                                flags = flags | constants.SAMPLED_MASK | constants.DEBUG_MASK;
                            }
                            break;
                        case constants.JAEGER_DEBUG_HEADER:
                            debugId = this._decodeValue(carrier[constants.JAEGER_DEBUG_HEADER]);
                            break;
                        case constants.JAEGER_BAGGAGE_HEADER:
                            (0, _baggage.parseCommaSeparatedBaggage)(baggage, this._decodeValue(carrier[key]));
                            break;
                        default:
                            if (_util2.default.startsWith(lowerKey, this._baggagePrefix)) {
                                var keyWithoutPrefix = key.substring(this._baggagePrefix.length);
                                baggage[keyWithoutPrefix] = this._decodeValue(carrier[key]);
                            }
                    }
                }
            }

            if (!this._isValidZipkinId(traceId) || !this._isValidZipkinId(spanId) || !this._isValidZipkinId(parentId)) {
                // Use a context devoid of trace/span/parentSpan IDs (to be
                // consistent with the default codec behavior), and increment a
                // metric
                traceId = spanId = parentId = '';
                this._metrics.decodingErrors.increment(1);
            }

            return _span_context2.default.withStringIds(traceId, spanId, parentId, flags, baggage, debugId);
        }
    }, {
        key: 'inject',
        value: function inject(spanContext, carrier) {
            carrier[ZIPKIN_TRACE_HEADER] = spanContext.traceIdStr;
            carrier[ZIPKIN_PARENTSPAN_HEADER] = spanContext.parentIdStr;
            carrier[ZIPKIN_SPAN_HEADER] = spanContext.spanIdStr;

            if (spanContext.isDebug()) {
                carrier[ZIPKIN_FLAGS_HEADER] = '1';
            } else {
                // Only set the zipkin sampled header if we're NOT using debug.
                // Per https://github.com/openzipkin/b3-propagation
                //   "Since Debug implies Sampled, so don't also send "X-B3-Sampled: 1"
                carrier[ZIPKIN_SAMPLED_HEADER] = spanContext.isSampled() ? '1' : '0';
            }

            var baggage = spanContext.baggage;
            for (var key in baggage) {
                if (baggage.hasOwnProperty(key)) {
                    var value = this._encodeValue(spanContext.baggage[key]);
                    carrier['' + this._baggagePrefix + key] = value;
                }
            }
        }
    }]);

    return ZipkinB3TextMapCodec;
}();

exports.default = ZipkinB3TextMapCodec;
//# sourceMappingURL=zipkin_b3_text_map_codec.js.map
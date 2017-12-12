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

var TextMapCodec = function () {
    function TextMapCodec() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, TextMapCodec);

        this._urlEncoding = !!options.urlEncoding;
        this._contextKey = options.contextKey || constants.TRACER_STATE_HEADER_NAME;
        this._contextKey = this._contextKey.toLowerCase();
        this._baggagePrefix = options.baggagePrefix || constants.TRACER_BAGGAGE_HEADER_PREFIX;
        this._baggagePrefix = this._baggagePrefix.toLowerCase();
        this._metrics = options.metrics || new _metrics2.default(new _metric_factory2.default());
    }

    _createClass(TextMapCodec, [{
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
            var spanContext = new _span_context2.default();
            var baggage = {};
            var debugId = '';

            for (var key in carrier) {
                if (carrier.hasOwnProperty(key)) {
                    var lowerKey = key.toLowerCase();
                    if (lowerKey === this._contextKey) {
                        var decodedContext = _span_context2.default.fromString(this._decodeValue(carrier[key]));
                        if (decodedContext === null) {
                            this._metrics.decodingErrors.increment(1);
                        } else {
                            spanContext = decodedContext;
                        }
                    } else if (lowerKey === constants.JAEGER_DEBUG_HEADER) {
                        debugId = this._decodeValue(carrier[key]);
                    } else if (lowerKey === constants.JAEGER_BAGGAGE_HEADER) {
                        (0, _baggage.parseCommaSeparatedBaggage)(baggage, this._decodeValue(carrier[key]));
                    } else if (_util2.default.startsWith(lowerKey, this._baggagePrefix)) {
                        var keyWithoutPrefix = key.substring(this._baggagePrefix.length);
                        baggage[keyWithoutPrefix] = this._decodeValue(carrier[key]);
                    }
                }
            }

            spanContext.debugId = debugId;
            spanContext.baggage = baggage;
            return spanContext;
        }
    }, {
        key: 'inject',
        value: function inject(spanContext, carrier) {
            var stringSpanContext = spanContext.toString();
            carrier[this._contextKey] = stringSpanContext; // no need to encode this

            var baggage = spanContext.baggage;
            for (var key in baggage) {
                if (baggage.hasOwnProperty(key)) {
                    var value = this._encodeValue(spanContext.baggage[key]);
                    carrier['' + this._baggagePrefix + key] = value;
                }
            }
        }
    }]);

    return TextMapCodec;
}();

exports.default = TextMapCodec;
//# sourceMappingURL=text_map_codec.js.map
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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TRACER_STATE_HEADER_NAME = 'uber-trace-id';
var TRACER_BAGGAGE_HEADER_PREFIX = 'uberctx-';

var TextMapCodec = function () {
    function TextMapCodec() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, TextMapCodec);

        this._urlEncoding = !!options.urlEncoding;
        this._contextKey = options.contextKey || TRACER_STATE_HEADER_NAME;
        this._contextKey = this._contextKey.toLowerCase();
        this._baggagePrefix = options.baggagePrefix || TRACER_BAGGAGE_HEADER_PREFIX;
        this._baggagePrefix = this._baggagePrefix.toLowerCase();
        this._metrics = options.metrics || new _metrics2.default(new _metric_factory2.default());
    }

    _createClass(TextMapCodec, [{
        key: '_encodedValue',
        value: function _encodedValue(value) {
            if (this._urlEncoding) {
                return encodeURIComponent(value);
            }

            return value;
        }
    }, {
        key: '_decodedValue',
        value: function _decodedValue(value) {
            if (this._urlEncoding) {
                return decodeURIComponent(value);
            }

            return value;
        }
    }, {
        key: 'extract',
        value: function extract(carrier) {
            // $FlowIgnore - I just want an empty span context.
            var spanContext = new _span_context2.default();
            var baggage = {};
            var debugId = void 0;

            for (var key in carrier) {
                if (carrier.hasOwnProperty(key)) {
                    var lowerKey = key.toLowerCase();
                    if (lowerKey === this._contextKey) {
                        var decodedContext = _span_context2.default.fromString(this._decodedValue(carrier[key]));
                        if (decodedContext === null) {
                            this._metrics.decodingErrors.increment(1);
                        } else {
                            spanContext = decodedContext;
                        }
                    }

                    if (lowerKey === constants.JAEGER_DEBUG_HEADER) {
                        debugId = this._decodedValue(carrier[key]);
                    }

                    if (_util2.default.startsWith(lowerKey, this._baggagePrefix)) {
                        var keyWithoutPrefix = key.substring(this._baggagePrefix.length);
                        baggage[keyWithoutPrefix] = this._decodedValue(carrier[key]);
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
            carrier[this._contextKey] = this._encodedValue(stringSpanContext);

            var baggage = spanContext.baggage;
            for (var key in baggage) {
                if (baggage.hasOwnProperty(key)) {
                    var value = this._encodedValue(spanContext.baggage[key]);
                    carrier['' + this._baggagePrefix + key] = value;
                }
            }
        }
    }]);

    return TextMapCodec;
}();

exports.default = TextMapCodec;
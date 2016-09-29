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

var _span_context = require('../span_context.js');

var _span_context2 = _interopRequireDefault(_span_context);

var _util = require('../util.js');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TRACER_STATE_HEADER_NAME = 'UBER-TRACE-ID';
var TRACER_BAGGAGE_HEADER_PREFIX = 'UberCtx-';

var TextMapCodec = function () {
    function TextMapCodec(urlEncoding) {
        var contextKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : TRACER_STATE_HEADER_NAME;
        var baggagePrefix = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : TRACER_BAGGAGE_HEADER_PREFIX;

        _classCallCheck(this, TextMapCodec);

        this._urlEncoding = urlEncoding;
        this._contextKey = contextKey;
        this._baggagePrefix = baggagePrefix;
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
            var header = carrier[this._contextKey];
            var spanContext = null;
            if (header) {
                spanContext = _span_context2.default.fromString(this._decodedValue(header));
                var baggage = {};
                for (var key in carrier) {
                    if (carrier.hasOwnProperty(key) && _util2.default.startsWith(key, this._baggagePrefix)) {
                        var keyWithoutPrefix = key.substring(this._baggagePrefix.length);
                        var value = this._decodedValue(carrier[key]);
                        baggage[keyWithoutPrefix] = value;
                    }
                }
                spanContext.baggage = baggage;
            }

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
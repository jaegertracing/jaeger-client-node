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

var _rate_limiter = require('../rate_limiter.js');

var _rate_limiter2 = _interopRequireDefault(_rate_limiter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var RateLimitingSampler = function () {
    function RateLimitingSampler(maxTracesPerSecond) {
        _classCallCheck(this, RateLimitingSampler);

        if (maxTracesPerSecond < 0) {
            throw new Error('maxTracesPerSecond must be greater than 0.0.  Received ' + maxTracesPerSecond);
        }
        var maxBalance = maxTracesPerSecond < 1.0 ? 1.0 : maxTracesPerSecond;

        this._maxTracesPerSecond = maxTracesPerSecond;
        this._rateLimiter = new _rate_limiter2.default(maxTracesPerSecond, maxBalance);
    }

    _createClass(RateLimitingSampler, [{
        key: 'name',
        value: function name() {
            return 'RateLimitingSampler';
        }
    }, {
        key: 'toString',
        value: function toString() {
            return this.name() + '(maxTracesPerSecond=' + this._maxTracesPerSecond + ')';
        }
    }, {
        key: 'isSampled',
        value: function isSampled(operation, tags) {
            var decision = this._rateLimiter.checkCredit(1.0);
            if (decision) {
                tags[constants.SAMPLER_TYPE_TAG_KEY] = constants.SAMPLER_TYPE_RATE_LIMITING;
                tags[constants.SAMPLER_PARAM_TAG_KEY] = this._maxTracesPerSecond;
            }
            return decision;
        }
    }, {
        key: 'equal',
        value: function equal(other) {
            if (!(other instanceof RateLimitingSampler)) {
                return false;
            }

            return this.maxTracesPerSecond === other.maxTracesPerSecond;
        }
    }, {
        key: 'close',
        value: function close(callback) {
            if (callback) {
                callback();
            }
        }
    }, {
        key: 'maxTracesPerSecond',
        get: function get() {
            return this._maxTracesPerSecond;
        }
    }]);

    return RateLimitingSampler;
}();

exports.default = RateLimitingSampler;
//# sourceMappingURL=ratelimiting_sampler.js.map
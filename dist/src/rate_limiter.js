"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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

var RateLimiter = function () {
    function RateLimiter(creditsPerSecond, maxBalance) {
        _classCallCheck(this, RateLimiter);

        this._creditsPerSecond = creditsPerSecond;
        this._balance = maxBalance;
        this._maxBalance = maxBalance;
        this._lastTick = new Date().getTime();
    }

    _createClass(RateLimiter, [{
        key: "checkCredit",
        value: function checkCredit(itemCost) {
            var currentTime = new Date().getTime();
            var elapsedTime = (currentTime - this._lastTick) / 1000;
            this._lastTick = currentTime;

            this._balance += elapsedTime * this._creditsPerSecond;
            if (this._balance > this._maxBalance) {
                this._balance = this._maxBalance;
            }
            if (this._balance >= itemCost) {
                this._balance -= itemCost;
                return true;
            }
            return false;
        }
    }]);

    return RateLimiter;
}();

exports.default = RateLimiter;
//# sourceMappingURL=rate_limiter.js.map
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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

var RateLimiter = function () {
    function RateLimiter(creditsPerSecond, maxBalance, initBalance) {
        _classCallCheck(this, RateLimiter);

        this._creditsPerSecond = creditsPerSecond;
        this._balance = initBalance || Math.random() * maxBalance;
        this._maxBalance = maxBalance;
        this._lastTick = new Date().getTime();
    }

    _createClass(RateLimiter, [{
        key: "update",
        value: function update(creditsPerSecond, maxBalance) {
            this._creditsPerSecond = creditsPerSecond;
            this._maxBalance = maxBalance;
            if (this._balance > maxBalance) {
                this._balance = maxBalance;
            }
        }
    }, {
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
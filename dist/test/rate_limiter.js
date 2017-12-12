'use strict';

var _chai = require('chai');

var _rate_limiter = require('../src/rate_limiter');

var _rate_limiter2 = _interopRequireDefault(_rate_limiter);

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('leaky bucket ratelimiter should', function () {
    it('block after threshold is met', function () {
        var initialDate = new Date(2011, 9, 1).getTime();
        var clock = _sinon2.default.useFakeTimers(initialDate);
        var limiter = new _rate_limiter2.default(10, 10, 10);
        for (var i = 0; i < 10; i++) {
            _chai.assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');
        }
        _chai.assert.equal(limiter.checkCredit(1), false, 'expected checkCredit to be false');

        clock.restore();
        clock = _sinon2.default.useFakeTimers(initialDate + 1000);
        for (var _i = 0; _i < 10; _i++) {
            _chai.assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');
        }
        _chai.assert.equal(limiter.checkCredit(1), false, 'expected checkCredit to be false');
        clock.restore();
    });

    it('work for fractional values', function () {
        var initialDate = new Date(2011, 9, 1).getTime();
        var clock = _sinon2.default.useFakeTimers(initialDate);
        var limit = 500;
        var cost = 1 / limit;
        var limiter = new _rate_limiter2.default(1, 1);
        for (var i = 0; i < limit; i++) {
            limiter.checkCredit(cost);
        }

        _chai.assert.equal(limiter.checkCredit(cost), false, 'expected checkCredit to be false');

        clock.restore();
        clock = _sinon2.default.useFakeTimers(initialDate + 1000);
        _chai.assert.equal(limiter.checkCredit(cost), true, 'expected checkCredit to be true');
        clock.restore();
    });

    it('work with creditsPerSecond smaller than 1', function () {
        var initialDate = new Date(2011, 9, 1).getTime();
        var clock = _sinon2.default.useFakeTimers(initialDate);
        var limiter = new _rate_limiter2.default(0.1, 1, 1);
        _chai.assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');

        clock.restore();
        // move time 20s forward, enough to accumulate credits for 2 messages, but it should still be capped at 1
        clock = _sinon2.default.useFakeTimers(initialDate + 20000);
        _chai.assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');
        _chai.assert.equal(limiter.checkCredit(1), false, 'expected checkCredit to be false');
        clock.restore();
    });

    it('update balance', function () {
        var initialDate = new Date(2011, 9, 1).getTime();
        var clock = _sinon2.default.useFakeTimers(initialDate);
        var limiter = new _rate_limiter2.default(0.1, 1);
        _chai.assert.equal(true, limiter._balance <= 1 && limiter._balance >= 0);
        limiter._balance = 1.0;
        _chai.assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');

        limiter.update(0.1, 3);
        clock.restore();
        // move time 20s forward, enough to accumulate credits for 2 messages
        clock = _sinon2.default.useFakeTimers(initialDate + 20000);
        _chai.assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');
        _chai.assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');
        _chai.assert.equal(limiter.checkCredit(1), false, 'expected checkCredit to be false');

        // move time 30s forward, enough to accumulate credits for another message (should have
        // enough credits for 3 at this point)
        clock = _sinon2.default.useFakeTimers(initialDate + 50000);
        _chai.assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');
        _chai.assert.equal(limiter._balance, 2, 'balance should be at 2 after spending 1');

        // reduce the maxBalance so the limiter is capped at 1
        limiter.update(0.1, 1);
        _chai.assert.equal(limiter._balance, 1, 'balance should be at 1 after update');
        _chai.assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');
        _chai.assert.equal(limiter.checkCredit(1), false, 'expected checkCredit to be false');
        clock.restore();
    });
}); // Copyright (c) 2016 Uber Technologies, Inc.
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
//# sourceMappingURL=rate_limiter.js.map
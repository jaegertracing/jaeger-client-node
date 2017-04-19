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
        var limiter = new _rate_limiter2.default(10, 10);
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
        var limiter = new _rate_limiter2.default(0.1, 1);
        _chai.assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');

        clock.restore();
        // move time 20s forward, enough to accumulate credits for 2 messages, but it should still be capped at 1
        clock = _sinon2.default.useFakeTimers(initialDate + 20000);
        _chai.assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');
        _chai.assert.equal(limiter.checkCredit(1), false, 'expected checkCredit to be false');
        clock.restore();
    });
}); // Copyright (c) 2016 Uber Technologies, Inc.
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
//# sourceMappingURL=rate_limiter.js.map
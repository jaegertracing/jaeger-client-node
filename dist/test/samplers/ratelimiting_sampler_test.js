'use strict';

var _chai = require('chai');

var _probabilistic_sampler = require('../../src/samplers/probabilistic_sampler.js');

var _probabilistic_sampler2 = _interopRequireDefault(_probabilistic_sampler);

var _ratelimiting_sampler = require('../../src/samplers/ratelimiting_sampler.js');

var _ratelimiting_sampler2 = _interopRequireDefault(_ratelimiting_sampler);

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

describe('RateLimitingSampler should', function () {
    it('block after threshold is met', function () {
        var initialDate = new Date(2011, 9, 1).getTime();
        var clock = _sinon2.default.useFakeTimers(initialDate);
        var sampler = new _ratelimiting_sampler2.default(10);
        for (var i = 0; i < 10; i++) {
            _chai.assert.equal(sampler.isSampled('operation', {}), true, 'expected decision to be true');
        }

        _chai.assert.equal(sampler.maxTracesPerSecond, 10);
        _chai.assert.isNotOk(sampler.equal(new _probabilistic_sampler2.default(0.5)));

        var tags = {};
        var decision = sampler.isSampled('operation', tags);
        _chai.assert.equal(decision, false, 'expected decision to be false');
        _chai.assert.deepEqual(tags, {}, 'expected tags to be empty');

        clock = _sinon2.default.useFakeTimers(initialDate + 1000);
        tags = {};
        decision = sampler.isSampled('operation', tags);
        _chai.assert.equal(decision, true, 'expected decision to be true');
        _chai.assert.deepEqual(tags, { 'sampler.type': 'ratelimiting', 'sampler.param': 10 });
        clock.restore();
    });

    it('should throw error when initialized with an incorrect value', function () {
        (0, _chai.expect)(function () {
            new _ratelimiting_sampler2.default(-2.0);
        }).to.throw('maxTracesPerSecond must be greater than 0.0.  Received -2');
    });

    it('should equal another rate limiting sampler', function () {
        var sampler = new _ratelimiting_sampler2.default(1.0);
        var otherSampler = new _ratelimiting_sampler2.default(1.0);

        _chai.assert.isOk(sampler.equal(otherSampler));
    });

    it('work with maxCreditsPerSecond smaller than 1', function () {
        var initialDate = new Date(2011, 9, 1).getTime();
        var clock = _sinon2.default.useFakeTimers(initialDate);
        var sampler = new _ratelimiting_sampler2.default(0.1);

        _chai.assert.equal(sampler.isSampled('operation', {}), true, 'expected decision to be true');

        clock = _sinon2.default.useFakeTimers(initialDate + 10000);
        _chai.assert.equal(sampler.isSampled('operation', {}), true, 'expected decision to be true');
        clock.restore();
    });
});
//# sourceMappingURL=ratelimiting_sampler_test.js.map
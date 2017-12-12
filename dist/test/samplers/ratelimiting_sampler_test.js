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
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed under the License
// is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied. See the License for the specific language governing permissions and limitations under
// the License.

describe('RateLimitingSampler should', function () {
    it('block after threshold is met', function () {
        var initialDate = new Date(2011, 9, 1).getTime();
        var clock = _sinon2.default.useFakeTimers(initialDate);
        var sampler = new _ratelimiting_sampler2.default(10, 10);
        for (var i = 0; i < 10; i++) {
            _chai.assert.isTrue(sampler.isSampled('operation', {}), 'expected decision to be true');
        }

        _chai.assert.equal(sampler.maxTracesPerSecond, 10);
        _chai.assert.isNotOk(sampler.equal(new _probabilistic_sampler2.default(0.5)));

        var tags = {};
        var decision = sampler.isSampled('operation', tags);
        _chai.assert.isFalse(decision, 'expected decision to be false');
        _chai.assert.deepEqual(tags, {}, 'expected tags to be empty');

        clock = _sinon2.default.useFakeTimers(initialDate + 1000);
        tags = {};
        decision = sampler.isSampled('operation', tags);
        _chai.assert.isTrue(decision, 'expected decision to be true');
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
        var sampler = new _ratelimiting_sampler2.default(0.1, 1);

        _chai.assert.isTrue(sampler.isSampled('operation', {}), 'expected decision to be true');

        clock = _sinon2.default.useFakeTimers(initialDate + 10000);
        _chai.assert.isTrue(sampler.isSampled('operation', {}), 'expected decision to be true');
        clock.restore();
    });

    it('should update successfully', function () {
        var initialDate = new Date(2011, 9, 1).getTime();
        var clock = _sinon2.default.useFakeTimers(initialDate);
        var sampler = new _ratelimiting_sampler2.default(1.0, 1);

        _chai.assert.isTrue(sampler.isSampled('operation', {}), 'expected decision to be true');

        _chai.assert.isFalse(sampler.update(1.0), 'updating using the same maxTracesPerSecond should return false');
        _chai.assert.isTrue(sampler.update(2.0), 'updating using a different maxTracesPerSecond should return true');

        clock = _sinon2.default.useFakeTimers(initialDate + 20000);
        var tags = {};
        _chai.assert.isTrue(sampler.isSampled('operation', tags), 'expected decision to be true');
        _chai.assert.deepEqual(tags, { 'sampler.type': 'ratelimiting', 'sampler.param': 2 });
        _chai.assert.isTrue(sampler.isSampled('operation', {}), 'expected decision to be true');
        _chai.assert.isFalse(sampler.isSampled('operation', {}), 'expected decision to be false');
        clock.restore();
    });

    it('should throw error when updated with an incorrect value', function () {
        var limiter = new _ratelimiting_sampler2.default(2.0);
        (0, _chai.expect)(function () {
            limiter.update(-2.0);
        }).to.throw('maxTracesPerSecond must be greater than 0.0.  Received -2');
    });
});
//# sourceMappingURL=ratelimiting_sampler_test.js.map
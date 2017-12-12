'use strict';

var _chai = require('chai');

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _const_sampler = require('../../src/samplers/const_sampler');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _guaranteed_throughput_sampler = require('../../src/samplers/guaranteed_throughput_sampler');

var _guaranteed_throughput_sampler2 = _interopRequireDefault(_guaranteed_throughput_sampler);

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

describe('GuaranteedThroughput sampler', function () {
    it('should have a name and be closable', function () {
        var sampler = new _guaranteed_throughput_sampler2.default(2, 0);
        _chai.assert.equal(sampler.name(), 'GuaranteedThroughputSampler');

        var callback = _sinon2.default.spy();
        sampler.close(callback);
        (0, _chai.assert)(callback.calledOnce);
    });

    it('should not equal other types', function () {
        var sampler = new _guaranteed_throughput_sampler2.default(2, 0);
        _chai.assert.isFalse(sampler.equal(new _const_sampler2.default(true)));
        sampler.close();
    });

    it('should equal itself', function () {
        var sampler = new _guaranteed_throughput_sampler2.default(2, 0);
        _chai.assert.isOk(sampler.equal(sampler));
        _chai.assert.isOk(sampler.equal(new _guaranteed_throughput_sampler2.default(2, 0)));
        sampler.close();
    });

    it('should provide minimum throughput', function () {
        var initialDate = new Date(2011, 9, 1).getTime();
        var clock = _sinon2.default.useFakeTimers(initialDate);
        var sampler = new _guaranteed_throughput_sampler2.default(2, 0);
        clock = _sinon2.default.useFakeTimers(initialDate + 20000);

        var expectedTags = { 'sampler.type': 'lowerbound', 'sampler.param': 0 };
        [true, true, false].forEach(function (expectedDecision) {
            var actualTags = {};
            var decision = sampler.isSampled('testOperationName', actualTags);
            // We asked for 2 traces per second and 0% probability for the rest.
            // Since the test runs under one second, we expect 2 successful samples
            // and one unsuccessful.
            if (expectedDecision) {
                _chai.assert.isOk(decision, 'must sample');
                _chai.assert.deepEqual(expectedTags, actualTags);
            } else {
                _chai.assert.isNotOk(decision, 'must not sample');
                _chai.assert.deepEqual({}, actualTags);
            }
        });

        clock.restore();
        sampler.close();
    });

    var assertValues = function assertValues(sampler, lb, rate) {
        _chai.assert.equal(lb, sampler._lowerBoundSampler.maxTracesPerSecond);
        _chai.assert.equal(rate, sampler._probabilisticSampler.samplingRate);
    };

    it('should not change when update() called with the same values', function () {
        var sampler = new _guaranteed_throughput_sampler2.default(2, 1.0);
        assertValues(sampler, 2, 1.0);

        var p1 = sampler._probabilisticSampler;
        var p2 = sampler._lowerBoundSampler;
        var isUpdated = sampler.update(2, 1.0);
        _chai.assert.isFalse(isUpdated);
        _chai.assert.strictEqual(sampler._probabilisticSampler, p1);
        _chai.assert.strictEqual(sampler._lowerBoundSampler, p2);
        assertValues(sampler, 2, 1.0);
    });

    it('should update only lower bound', function () {
        var sampler = new _guaranteed_throughput_sampler2.default(2, 1.0);
        assertValues(sampler, 2, 1.0);

        // should only change lower bound
        var p1 = sampler._probabilisticSampler;
        var p2 = sampler._lowerBoundSampler;
        var isUpdated = sampler.update(3, 1.0);
        _chai.assert.isTrue(isUpdated);
        _chai.assert.strictEqual(sampler._probabilisticSampler, p1);
        _chai.assert.strictEqual(sampler._lowerBoundSampler, p2, 'lowerbound sampler should only be updated, not recreated');
        assertValues(sampler, 3, 1.0);
    });

    it('should update only sampling rate', function () {
        var sampler = new _guaranteed_throughput_sampler2.default(2, 1.0);
        assertValues(sampler, 2, 1.0);

        var p1 = sampler._probabilisticSampler;
        var p2 = sampler._lowerBoundSampler;
        var isUpdated = sampler.update(2, 0.9);
        _chai.assert.isTrue(isUpdated);
        _chai.assert.isNotOk(p1 === sampler._probabilisticSampler);
        _chai.assert.strictEqual(sampler._lowerBoundSampler, p2);
        assertValues(sampler, 2, 0.9);
    });

    it('should become probabilistic after minimum throughput', function () {
        var initialDate = new Date(2011, 9, 1).getTime();
        var clock = _sinon2.default.useFakeTimers(initialDate);
        var sampler = new _guaranteed_throughput_sampler2.default(2, 1.0);
        clock = _sinon2.default.useFakeTimers(initialDate + 20000);

        var expectedTagsLB = { 'sampler.type': 'lowerbound', 'sampler.param': 0.0 };
        var expectedTagsProb = { 'sampler.type': 'probabilistic', 'sampler.param': 1.0 };

        // The sampler is setup with 2 traces per second and 100% probability otherwise.
        // The 100% probability takes precedence over lower-bound, so we manipulate
        // the probability for every iteration.
        [
        // 100% probability triggers probabilistic sampler
        { num: 1, probability: 1, sampled: true, tags: expectedTagsProb },
        // 0% probability triggers lower-bound sampler
        { num: 2, probability: 0, sampled: true, tags: expectedTagsLB },
        // 0% probability results in sampled=false because rate limit was reached 
        { num: 3, probability: 0, sampled: false, tags: {} },
        // 100% probability triggers probabilitic sampler again
        { num: 4, probability: 1, sampled: true, tags: expectedTagsProb }].forEach(function (testCase) {
            // override probability, and do a sanity check
            var s = sampler._lowerBoundSampler;
            sampler.update(2, testCase.probability);
            _chai.assert.strictEqual(s, sampler._lowerBoundSampler, 'lower bound sampled unchanged');
            _chai.assert.equal(sampler._probabilisticSampler.samplingRate, testCase.probability);

            var expectedDecision = testCase.sampled;
            var expectedTags = testCase.tags;

            var actualTags = {};
            var decision = sampler.isSampled('testOperationName', actualTags);
            if (expectedDecision) {
                _chai.assert.isOk(decision, 'must sample, test case ' + testCase.num);
                _chai.assert.deepEqual(expectedTags, actualTags, 'must match tags, test case ' + testCase.num);
            } else {
                _chai.assert.isNotOk(decision, 'must not sample, test case ' + testCase.num);
                _chai.assert.deepEqual({}, actualTags, 'must not have tags, test case ' + testCase.num);
            }
        });

        clock.restore();
        sampler.close();
    });
});
//# sourceMappingURL=guaranteed_throughput_sampler.js.map
// @flow
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

import {assert} from 'chai';
import sinon from 'sinon';
import ConstSampler from '../../src/samplers/const_sampler';
import GuaranteedThroughputSampler from '../../src/samplers/guaranteed_throughput_sampler';

describe('GuaranteedThroughput sampler', () => {
    it('should have a name and be closable', () => {
        let sampler = new GuaranteedThroughputSampler(0, 2, 3);
        assert.equal(sampler.name(), 'GuaranteedThroughputSampler');

        let callback = sinon.spy();
        sampler.close(callback);
        assert(callback.calledOnce);
    });

    it('should not equal other types', () => {
        let sampler = new GuaranteedThroughputSampler(0, 2, 3);
        assert.isFalse(sampler.equal(new ConstSampler(true)));
        sampler.close();
    });

    it('should equal itself', () => {
        let sampler = new GuaranteedThroughputSampler(0, 2, 3);
        assert.isOk(sampler.equal(sampler));
        assert.isOk(sampler.equal(new GuaranteedThroughputSampler(0, 2, 3)));
        sampler.close();
    });

    it('should provide minimum throughput', () => {
        let sampler = new GuaranteedThroughputSampler(0, 2, 3);

        let expectedTags = {'sampler.type': 'lowerbound', 'sampler.param': 0};
        [true, true, false].forEach((expectedDecision) => {
            let actualTags = {};
            let decision = sampler.isSampled('testOperationName', actualTags);
            // We asked for 2 traces per second and 0% probability for the rest.
            // Since the test runs under one second, we expect 2 successful samples
            // and one unsuccessful.
            if (expectedDecision) {
                assert.isOk(decision, 'must sample');
                assert.deepEqual(expectedTags, actualTags);
            } else {
                assert.isNotOk(decision, 'must not sample');
                assert.deepEqual({}, actualTags);
            }
        });

        sampler.close();
    });

    it('should rate limited by upper bound rate limiter', () => {
        let sampler = new GuaranteedThroughputSampler(1, 1, 2);

        let expectedTags = {'sampler.type': 'probabilistic', 'sampler.param': 1};
        [1, 2, 3].forEach((_) => {
            let actualTags = {};
            assert.isOk(sampler.isSampled('testOperationName', actualTags), 'must sample');
            assert.deepEqual(expectedTags, actualTags);
        });
        // The max_samples_per_second is 2, so after three calls, the upperBoundRateLimiter
        // should be triggered and the samplingRate should be halved.
        assertValues(sampler, 0.5, 1, 2);

        sampler.close();
    });

    let assertValues = function assertValues(sampler, rate, lb, up) {
        assert.equal(rate, sampler._probabilisticSampler.samplingRate);
        assert.equal(lb, sampler._lowerBoundSampler.maxTracesPerSecond);
        assert.equal(up, sampler._upperBoundRateLimiter.creditsPerSecond);
    };

    it('should not change when update() called with the same values', () => {
        let sampler = new GuaranteedThroughputSampler(1.0, 2, 3);
        assertValues(sampler, 1.0, 2, 3);

        let p1 = sampler._probabilisticSampler;
        let p2 = sampler._lowerBoundSampler;
        let p3 = sampler._upperBoundRateLimiter;
        let isUpdated: boolean = sampler.update(1.0, 2, 3);
        assert.isFalse(isUpdated);
        assert.strictEqual(sampler._probabilisticSampler, p1);
        assert.strictEqual(sampler._lowerBoundSampler, p2);
        assert.strictEqual(sampler._upperBoundRateLimiter, p3);
        assertValues(sampler, 1.0, 2, 3);
    });

    it('should update only lower bound and upper bound', () => {
        let sampler = new GuaranteedThroughputSampler(1.0, 2, 3);
        assertValues(sampler, 1.0, 2, 3);

        // should only change lower bound
        let p1 = sampler._probabilisticSampler;
        let p2 = sampler._lowerBoundSampler;
        let p3 = sampler._upperBoundRateLimiter;
        let isUpdated: boolean = sampler.update(1.0, 3, 4);
        assert.isTrue(isUpdated);
        assert.strictEqual(sampler._probabilisticSampler, p1);
        assert.isNotOk(p2 === sampler._lowerBoundSampler);
        assert.isNotOk(p3 === sampler._upperBoundRateLimiter);
        assertValues(sampler, 1.0, 3, 4);
    });

    it('should update only sampling rate', () => {
        let sampler = new GuaranteedThroughputSampler(1.0, 2, 3);
        assertValues(sampler, 1.0, 2, 3);

        let p1 = sampler._probabilisticSampler;
        let p2 = sampler._lowerBoundSampler;
        let p3 = sampler._upperBoundRateLimiter;
        let isUpdated: boolean = sampler.update(0.9, 2, 3);
        assert.isTrue(isUpdated);
        assert.isNotOk(p1 === sampler._probabilisticSampler);
        assert.strictEqual(sampler._lowerBoundSampler, p2);
        assert.strictEqual(sampler._upperBoundRateLimiter, p3);
        assertValues(sampler, 0.9, 2, 3);
    });

    it('should become probabilistic after minimum throughput', () => {
        let sampler = new GuaranteedThroughputSampler(1.0, 2, 3);

        let expectedTagsLB = {'sampler.type': 'lowerbound', 'sampler.param': 0.0};
        let expectedTagsProb = {'sampler.type': 'probabilistic', 'sampler.param': 1.0};

        // The sampler is setup with 2 traces per second and 100% probability otherwise.
        // The 100% probability takes precedence over lower-bound, so we manipulate
        // the probability for every iteration.
        [
            // 100% probability triggers probabilistic sampler
            {num: 1, probability: 1, sampled: true, tags: expectedTagsProb},
            // 0% probability triggers lower-bound sampler
            {num: 2, probability: 0, sampled: true, tags: expectedTagsLB},
            // 0% probability results in sampled=false because rate limit was reached 
            {num: 3, probability: 0, sampled: false, tags: {}},
            // 100% probability triggers probabilitic sampler again
            {num: 4, probability: 1, sampled: true, tags: expectedTagsProb}
        ].forEach((testCase) => {
            // override probability, and do a sanity check
            let s = sampler._lowerBoundSampler;
            let u = sampler._upperBoundRateLimiter;
            sampler.update(testCase.probability, 2, 3);
            assert.strictEqual(s, sampler._lowerBoundSampler, 'lower bound sampled unchanged');
            assert.strictEqual(u, sampler._upperBoundRateLimiter, 'upper bound rate limiter unchanged');
            assert.equal(sampler._probabilisticSampler.samplingRate, testCase.probability);

            let expectedDecision = testCase.sampled;
            let expectedTags = testCase.tags;

            let actualTags = {};
            let decision = sampler.isSampled('testOperationName', actualTags);
            if (expectedDecision) {
                assert.isOk(decision, `must sample, test case ${testCase.num}`);
                assert.deepEqual(expectedTags, actualTags, `must match tags, test case ${testCase.num}`);
            } else {
                assert.isNotOk(decision, `must not sample, test case ${testCase.num}`);
                assert.deepEqual({}, actualTags, `must not have tags, test case ${testCase.num}`);
            }
        });

        sampler.close();
    });
});

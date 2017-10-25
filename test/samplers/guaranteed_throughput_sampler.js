// @flow
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

import {assert} from 'chai';
import sinon from 'sinon';
import ConstSampler from '../../src/samplers/const_sampler';
import GuaranteedThroughputSampler from '../../src/samplers/guaranteed_throughput_sampler';

describe('GuaranteedThroughput sampler', () => {
    it('should have a name and be closable', () => {
        let sampler = new GuaranteedThroughputSampler(2, 0);
        assert.equal(sampler.name(), 'GuaranteedThroughputSampler');

        let callback = sinon.spy();
        sampler.close(callback);
        assert(callback.calledOnce);
    });

    it('should not equal other types', () => {
        let sampler = new GuaranteedThroughputSampler(2, 0);
        assert.isFalse(sampler.equal(new ConstSampler(true)));
        sampler.close();
    });

    it('should equal itself', () => {
        let sampler = new GuaranteedThroughputSampler(2, 0);
        assert.isOk(sampler.equal(sampler));
        assert.isOk(sampler.equal(new GuaranteedThroughputSampler(2, 0)));
        sampler.close();
    });

    it('should provide minimum throughput', () => {
        let initialDate = new Date(2011,9,1).getTime();
        let clock = sinon.useFakeTimers(initialDate);
        let sampler = new GuaranteedThroughputSampler(2, 0);
        clock = sinon.useFakeTimers(initialDate + 20000);

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

        clock.restore();
        sampler.close();
    });

    let assertValues = function assertValues(sampler, lb, rate) {
        assert.equal(lb, sampler._lowerBoundSampler.maxTracesPerSecond);
        assert.equal(rate, sampler._probabilisticSampler.samplingRate);
    };

    it('should not change when update() called with the same values', () => {
        let sampler = new GuaranteedThroughputSampler(2, 1.0);
        assertValues(sampler, 2, 1.0);

        let p1 = sampler._probabilisticSampler;
        let p2 = sampler._lowerBoundSampler;
        let isUpdated: boolean = sampler.update(2, 1.0);
        assert.isFalse(isUpdated);
        assert.strictEqual(sampler._probabilisticSampler, p1);
        assert.strictEqual(sampler._lowerBoundSampler, p2);
        assertValues(sampler, 2, 1.0);
    });

    it('should update only lower bound', () => {
        let sampler = new GuaranteedThroughputSampler(2, 1.0);
        assertValues(sampler, 2, 1.0);

        // should only change lower bound
        let p1 = sampler._probabilisticSampler;
        let p2 = sampler._lowerBoundSampler;
        let isUpdated: boolean = sampler.update(3, 1.0);
        assert.isTrue(isUpdated);
        assert.strictEqual(sampler._probabilisticSampler, p1);
        assert.strictEqual(sampler._lowerBoundSampler, p2, 'lowerbound sampler should only be updated, not recreated');
        assertValues(sampler, 3, 1.0);
    });

    it('should update only sampling rate', () => {
        let sampler = new GuaranteedThroughputSampler(2, 1.0);
        assertValues(sampler, 2, 1.0);

        let p1 = sampler._probabilisticSampler;
        let p2 = sampler._lowerBoundSampler;
        let isUpdated: boolean = sampler.update(2, 0.9);
        assert.isTrue(isUpdated);
        assert.isNotOk(p1 === sampler._probabilisticSampler);
        assert.strictEqual(sampler._lowerBoundSampler, p2);
        assertValues(sampler, 2, 0.9);
    });

    it('should become probabilistic after minimum throughput', () => {
        let initialDate = new Date(2011,9,1).getTime();
        let clock = sinon.useFakeTimers(initialDate);
        let sampler = new GuaranteedThroughputSampler(2, 1.0);
        clock = sinon.useFakeTimers(initialDate + 20000);

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
            sampler.update(2, testCase.probability);
            assert.strictEqual(s, sampler._lowerBoundSampler, 'lower bound sampled unchanged');
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

        clock.restore();
        sampler.close();
    });
});

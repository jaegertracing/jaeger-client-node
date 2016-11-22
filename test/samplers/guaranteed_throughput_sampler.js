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
import GuaranteedThroughputSampler from '../../src/samplers/guaranteed_throughput_sampler';

describe('GuaranteedThroughput sampler', () => {
    it('should have a name and be closable', () => {
        let sampler = new GuaranteedThroughputSampler(2, 0);
        assert.equal(sampler.name(), 'GuaranteedThroughputSampler');

        let callback = sinon.spy();
        sampler.close(callback);
        assert(callback.calledOnce);
    });

    it('should equal nothing', () => {
        let sampler = new GuaranteedThroughputSampler(2, 0);
        assert.isNotOk(sampler.equal({}));
        assert.isNotOk(sampler.equal(sampler));
        sampler.close();
    });

    it('should provide minimum throughput', () => {
        let sampler = new GuaranteedThroughputSampler(2, 0);

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

    it('should become probabilistic after minimum throughput', () => {
        let sampler = new GuaranteedThroughputSampler(2, 1.0);

        let expectedTagsLB = {'sampler.type': 'lowerbound', 'sampler.param': 1.0};
        let expectedTagsProb = {'sampler.type': 'probabilistic', 'sampler.param': 1.0};

        // The sampler is setup with 2 traces per second and 100% probability otherwise.
        // The 100% probability takes precedence over lower-bound, so we manipulate
        // the probability for every iteration.
        [
            // 100% probability triggers probabilistic sampler
            {probability: 1, sampled: true, tags: expectedTagsProb},
            // 0% probability triggers lower-bound sampler
            {probability: 0, sampled: true, tags: expectedTagsLB},
            // 0% probability results in sampled=false because rate limit was reached 
            {probability: 0, sampled: false, tags: {}},
            // 100% probability triggers probabilitic sampler again
            {probability: 1, sampled: true, tags: expectedTagsProb}
        ].forEach((testCase) => {
            // override probability
            sampler._probabilisticSampler._samplingRate = testCase.probability;
            let expectedDecision = testCase.sampled;
            let expectedTags = testCase.tags;

            let actualTags = {};
            let decision = sampler.isSampled('testOperationName', actualTags);
            if (expectedDecision) {
                assert.isOk(decision, `must sample, test case ${testCase}`);
                assert.deepEqual(expectedTags, actualTags, `must match tags, test case ${testCase}`);
            } else {
                assert.isNotOk(decision, `must not sample, test case ${testCase}`);
                assert.deepEqual({}, actualTags, `must not have tags, test case ${testCase}`);
            }
        });

        sampler.close();
    });

    it('should update only the parts that changed', () => {
        let sampler = new GuaranteedThroughputSampler(2, 1.0);

        let assertValues = function assertValues(lb, rate) {
            assert.equal(lb, sampler._lowerBound);
            assert.equal(rate, sampler._samplingRate);
        };

        assertValues(2, 1.0);

        let p1 = sampler._probabilisticSampler;
        let p2 = sampler._lowerBoundSampler;
        sampler.update(3, 1.0);
        assert.isOk(p1 === sampler._probabilisticSampler);
        assert.isNotOk(p2 === sampler._lowerBoundSampler);
        assertValues(3, 1.0);

        p2 = sampler._lowerBoundSampler;
        sampler.update(3, 0.9);
        assert.isNotOk(p1 === sampler._probabilisticSampler);
        assert.isOk(p2 === sampler._lowerBoundSampler);
        assertValues(3, 0.9);
    });
});

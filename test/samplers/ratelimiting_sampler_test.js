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

import {assert, expect} from 'chai';
import ProbabilisticSampler from '../../src/samplers/probabilistic_sampler.js';
import RateLimitingSampler from '../../src/samplers/ratelimiting_sampler.js';
import sinon from 'sinon';

describe ('RateLimitingSampler should', () => {
    it('block after threshold is met', () => {
        let initialDate = new Date(2011,9,1).getTime();
        let clock = sinon.useFakeTimers(initialDate);
        let sampler = new RateLimitingSampler(10, 10);
        for (let i = 0; i < 10; i++) {
            assert.isTrue(sampler.isSampled('operation', {}), 'expected decision to be true');
        }

        assert.equal(sampler.maxTracesPerSecond, 10);
        assert.isNotOk(sampler.equal(new ProbabilisticSampler(0.5)));

        let tags = {};
        let decision = sampler.isSampled('operation', tags);
        assert.isFalse(decision, 'expected decision to be false');
        assert.deepEqual(tags, {}, 'expected tags to be empty');

        clock = sinon.useFakeTimers(initialDate + 1000);
        tags = {};
        decision = sampler.isSampled('operation', tags);
        assert.isTrue(decision, 'expected decision to be true');
        assert.deepEqual(tags, {'sampler.type': 'ratelimiting', 'sampler.param': 10});
        clock.restore();
    });

    it ('should throw error when initialized with an incorrect value', () => {
        expect(() => { new RateLimitingSampler(-2.0); }).to.throw('maxTracesPerSecond must be greater than 0.0.  Received -2');
    });

    it ('should equal another rate limiting sampler', () => {
        let sampler = new RateLimitingSampler(1.0);
        let otherSampler = new RateLimitingSampler(1.0);

        assert.isOk(sampler.equal(otherSampler));
    });

    it ('work with maxCreditsPerSecond smaller than 1', () => {
        let initialDate = new Date(2011,9,1).getTime();
        let clock = sinon.useFakeTimers(initialDate);
        let sampler = new RateLimitingSampler(0.1, 1);

        assert.isTrue(sampler.isSampled('operation', {}), 'expected decision to be true');

        clock = sinon.useFakeTimers(initialDate + 10000);
        assert.isTrue(sampler.isSampled('operation', {}), 'expected decision to be true');
        clock.restore();
    });

    it ('should update successfully', () => {
        let initialDate = new Date(2011,9,1).getTime();
        let clock = sinon.useFakeTimers(initialDate);
        let sampler = new RateLimitingSampler(1.0, 1);

        assert.isTrue(sampler.isSampled('operation', {}), 'expected decision to be true');

        assert.isFalse(sampler.update(1.0), 'updating using the same maxTracesPerSecond should return false');
        assert.isTrue(sampler.update(2.0), 'updating using a different maxTracesPerSecond should return true');

        clock = sinon.useFakeTimers(initialDate + 20000);
        let tags = {};
        assert.isTrue(sampler.isSampled('operation', tags), 'expected decision to be true');
        assert.deepEqual(tags, {'sampler.type': 'ratelimiting', 'sampler.param': 2});
        assert.isTrue(sampler.isSampled('operation', {}), 'expected decision to be true');
        assert.isFalse(sampler.isSampled('operation', {}), 'expected decision to be false');
        clock.restore();
    });

    it ('should throw error when updated with an incorrect value', () => {
        let limiter = new RateLimitingSampler(2.0);
        expect(() => { limiter.update(-2.0); }).to.throw('maxTracesPerSecond must be greater than 0.0.  Received -2');
    });
});

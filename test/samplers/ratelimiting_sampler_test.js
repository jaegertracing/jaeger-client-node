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

import {assert, expect} from 'chai';
import ProbabilisticSampler from '../../src/samplers/probabilistic_sampler.js';
import RateLimitingSampler from '../../src/samplers/ratelimiting_sampler.js';
import sinon from 'sinon';

describe ('RateLimitingSampler should', () => {
    it('block after threshold is met', () => {
        let initialDate = new Date(2011,9,1).getTime();
        let clock = sinon.useFakeTimers(initialDate);
        let sampler = new RateLimitingSampler(10);
        for (let i = 0; i < 10; i++) {
            assert.equal(sampler.isSampled('operation', {}), true, 'expected decision to be true');
        }

        assert.equal(sampler.maxTracesPerSecond, 10);
        assert.isNotOk(sampler.equal(new ProbabilisticSampler(0.5)));

        let tags = {};
        let decision = sampler.isSampled('operation', tags);
        assert.equal(decision, false, 'expected decision to be false');
        assert.deepEqual(tags, {}, 'expected tags to be empty');

        clock = sinon.useFakeTimers(initialDate + 1000);
        tags = {};
        decision = sampler.isSampled('operation', tags);
        assert.equal(decision, true, 'expected decision to be true');
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
        let sampler = new RateLimitingSampler(0.1);

        assert.equal(sampler.isSampled('operation', {}), true, 'expected decision to be true');

        clock = sinon.useFakeTimers(initialDate + 10000);
        assert.equal(sampler.isSampled('operation', {}), true, 'expected decision to be true');
        clock.restore();
    });
});

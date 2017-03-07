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
import RateLimiter from '../src/rate_limiter';
import sinon from 'sinon';

describe ('leaky bucket ratelimiter should', () => {
    it('block after threshold is met', () => {
        let initialDate = new Date(2011,9,1).getTime();
        let clock = sinon.useFakeTimers(initialDate);
        let limiter = new RateLimiter(10, 10);
        for (let i = 0; i < 10; i++) {
            assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');
        }
        assert.equal(limiter.checkCredit(1), false, 'expected checkCredit to be false');

        clock.restore();
        clock = sinon.useFakeTimers(initialDate + 1000);
        for (let i = 0; i < 10; i++) {
            assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');
        }
        assert.equal(limiter.checkCredit(1), false, 'expected checkCredit to be false');
        clock.restore();
    });

    it('work for fractional values', () => {
        let initialDate = new Date(2011,9,1).getTime();
        let clock = sinon.useFakeTimers(initialDate);
        let limit = 500;
        let cost = 1 / limit;
        let limiter = new RateLimiter(1, 1);
        for (let i = 0; i < limit; i++) {
            limiter.checkCredit(cost);
        }

        assert.equal(limiter.checkCredit(cost), false, 'expected checkCredit to be false');

        clock.restore();
        clock = sinon.useFakeTimers(initialDate + 1000);
        assert.equal(limiter.checkCredit(cost), true, 'expected checkCredit to be true');
        clock.restore();
    });

    it('work with creditsPerSecond smaller than 1', () => {
        let initialDate = new Date(2011,9,1).getTime();
        let clock = sinon.useFakeTimers(initialDate);
        let limiter = new RateLimiter(0.1, 1);
        assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');

        clock.restore();
        // move time 20s forward, enough to accumulate credits for 2 messages, but it should still be capped at 1
        clock = sinon.useFakeTimers(initialDate + 20000);
        assert.equal(limiter.checkCredit(1), true, 'expected checkCredit to be true');
        assert.equal(limiter.checkCredit(1), false, 'expected checkCredit to be false');
        clock.restore();
    });
});

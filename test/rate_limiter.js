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

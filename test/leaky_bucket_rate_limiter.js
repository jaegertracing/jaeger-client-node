import {assert} from 'chai';
import RateLimiter from '../src/leaky_bucket_rate_limiter';
import sinon from 'sinon';

describe ('leaky bucket ratelimiter should', () => {
    it('block after threshold is met', () => {
        let initialDate = new Date(2011,9,1).getTime();
        let clock = sinon.useFakeTimers(initialDate);
        let limiter = new RateLimiter(10);
        for (let i = 0; i < 10; i++) {
            limiter.checkCredit(1);
        }

        assert.equal(limiter.checkCredit(1), false, "expected checkCredit to be false");
        clock = sinon.useFakeTimers(initialDate + 1000);
        assert.equal(limiter.checkCredit(1), true, "expected checkCredit to be true");
        clock.restore();
    });

    it('work for fractional values', () => {
        let initialDate = new Date(2011,9,1).getTime();
        let clock = sinon.useFakeTimers(initialDate);
        let limit = 500;
        let cost = 1 / limit;
        let limiter = new RateLimiter(1);
        for (let i = 0; i < limit; i++) {
            limiter.checkCredit(cost);
        }

        assert.equal(limiter.checkCredit(cost), false, "expected checkCredit to be false");
        clock = sinon.useFakeTimers(initialDate + 1000);
        assert.equal(limiter.checkCredit(cost), true, "expected checkCredit to be true");
        clock.restore();
    });
});

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

import * as constants from '../constants.js';
import RateLimiter from '../leaky_bucket_rate_limiter.js';
import NullLogger from '../logger.js';

export default class RateLimitingSampler {
    _rateLimiter: RateLimiter;
    _maxTracesPerSecond: number;
    _logger: any;
    _tags: Array<Tag>;

    constructor(maxTracesPerSecond: number, logger: any) {
        this._logger = logger || new NullLogger();

        if (maxTracesPerSecond < 0) {
            this._logger._error(`maxTracesPerSecond must be greater than 0.0.  Received ${maxTracesPerSecond}`);
            return;
        }

        this._maxTracesPerSecond = maxTracesPerSecond;
        this._rateLimiter = new RateLimiter(maxTracesPerSecond);
        this._tags = [
            {'key': constants.SAMPLER_TYPE_TAG_KEY, 'value': constants.SAMPLER_TYPE_RATE_LIMITING},
            {'key': constants.SAMPLER_PARAM_TAG_KEY, 'value': `${this._maxTracesPerSecond}`}
        ];
    }

    get maxTracesPerSecond(): number {
        return this._maxTracesPerSecond;
    }

    isSampled(): boolean {
        return this._rateLimiter.checkCredit(1.0);
    }

    equal(other: Sampler): boolean {
        if (!(other instanceof RateLimitingSampler)) {
            return false;
        }

        return this.maxTracesPerSecond === other.maxTracesPerSecond;
    }

    getTags(): Array<Tag> {
        return this._tags;
    }

    close(callback: Function): void {
        if (callback) {
            callback();
        }
    }
}

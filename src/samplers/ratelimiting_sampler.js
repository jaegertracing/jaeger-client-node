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

import * as constants from '../constants.js';
import RateLimiter from '../rate_limiter.js';

export default class RateLimitingSampler {
    _rateLimiter: RateLimiter;
    _maxTracesPerSecond: number;

    constructor(maxTracesPerSecond: number, initBalance: ?number) {
        this._init(maxTracesPerSecond, initBalance);
    }

    update(maxTracesPerSecond: number): boolean {
        let prevMaxTracesPerSecond = this._maxTracesPerSecond;
        this._init(maxTracesPerSecond);
        return this._maxTracesPerSecond !== prevMaxTracesPerSecond;
    }

    _init(maxTracesPerSecond: number, initBalance: ?number) {
        if (maxTracesPerSecond < 0) {
            throw new Error(`maxTracesPerSecond must be greater than 0.0.  Received ${maxTracesPerSecond}`);
        }
        let maxBalance = maxTracesPerSecond < 1.0 ? 1.0 : maxTracesPerSecond;

        this._maxTracesPerSecond = maxTracesPerSecond;
        if (this._rateLimiter) {
            this._rateLimiter.update(maxTracesPerSecond, maxBalance);
        } else {
            this._rateLimiter = new RateLimiter(maxTracesPerSecond, maxBalance, initBalance);
        }
    }

    name(): string {
        return 'RateLimitingSampler';
    }

    toString(): string {
        return `${this.name()}(maxTracesPerSecond=${this._maxTracesPerSecond})`;
    }

    get maxTracesPerSecond(): number {
        return this._maxTracesPerSecond;
    }

    isSampled(operation: string, tags: any): boolean {
        let decision = this._rateLimiter.checkCredit(1.0);
        if (decision) {
            tags[constants.SAMPLER_TYPE_TAG_KEY] = constants.SAMPLER_TYPE_RATE_LIMITING;
            tags[constants.SAMPLER_PARAM_TAG_KEY] = this._maxTracesPerSecond;
        }
        return decision;
    }

    equal(other: Sampler): boolean {
        if (!(other instanceof RateLimitingSampler)) {
            return false;
        }

        return this.maxTracesPerSecond === other.maxTracesPerSecond;
    }

    close(callback: ?Function): void {
        if (callback) {
            callback();
        }
    }
}

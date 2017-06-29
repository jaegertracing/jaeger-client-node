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
import ProbabilisticSampler from './probabilistic_sampler.js';
import RateLimitingSampler from './ratelimiting_sampler.js';
import RateLimiter from './../rate_limiter.js';

// GuaranteedThroughputProbabilisticSampler is a sampler that leverages both probabilisticSampler and
// rateLimitingSampler. The rateLimitingSampler is used as a guaranteed lower bound sampler such that
// every operation is sampled at least once in a time interval defined by the lowerBound. ie a lowerBound
// of 1.0 / (60 * 10) will sample an operation at least once every 10 minutes.
//
// The probabilisticSampler is given higher priority when tags are emitted, ie. if IsSampled() for both
// samplers return true, the tags for probabilisticSampler will be used.
export default class GuaranteedThroughputSampler {
    _probabilisticSampler: ProbabilisticSampler;
    _lowerBoundSampler:    RateLimitingSampler;
    _upperBoundRateLimiter: RateLimiter;
    _tagsPlaceholder:      any;

    constructor(samplingRate: number, minSamplesPerSecond: number, maxSamplesPerSecond: number) {
        this._probabilisticSampler = new ProbabilisticSampler(samplingRate);
        this._lowerBoundSampler = new RateLimitingSampler(minSamplesPerSecond);
        this._upperBoundRateLimiter = new RateLimiter(maxSamplesPerSecond, maxSamplesPerSecond);
        // we never let the lowerBoundSampler return its real tags, so avoid allocations
        // by reusing the same placeholder object
        this._tagsPlaceholder = {};
    }

    name(): string {
        return 'GuaranteedThroughputSampler';
    }

    toString(): string {
        return `${this.name()}(samplingRate=${this._probabilisticSampler.samplingRate}, minSamplesPerSecond=${this._lowerBoundSampler.maxTracesPerSecond}, maxSamplesPerSecond=${this._upperBoundRateLimiter.creditsPerSecond})`;
    }

    isSampled(operation: string, tags: any): boolean {
        if (this._probabilisticSampler.isSampled(operation, tags)) {
            // make rate limiting sampler update its budget
            this._lowerBoundSampler.isSampled(operation, this._tagsPlaceholder);
            if (!this._upperBoundRateLimiter.checkCredit(1.0)) {
                this.reduce_sampling_rate();
            }
            return true;
        }
        let decision = this._lowerBoundSampler.isSampled(operation, this._tagsPlaceholder);
        if (decision) {
            tags[constants.SAMPLER_TYPE_TAG_KEY] = constants.SAMPLER_TYPE_LOWER_BOUND;
            tags[constants.SAMPLER_PARAM_TAG_KEY] = this._probabilisticSampler.samplingRate;
        }
        return decision;
    }

    // Due to inherent latencies in the adaptive sampling feedback loop, the new probabilities
    // are not calculated and propagated in real time. In the worst case, sampling probabilities
    // can take up to 2 minutes to propagate to the corresponding client. This means that adaptive
    // sampling cannot react to fluctuations in traffic.
    //
    // Under certain conditions, the sampling probability might increase to 100% (imagine having a
    // very low QPS operation). However, every now and then, this operation is hit with a ton of
    // traffic and all the requests are sampled before adaptive sampling can kick in and prevent
    // oversampling.
    //
    // To prevent this, we reduce the sampling probability wherever the upper bound rate limiter
    // is triggered such that clients don't over sample during traffic spikes.
    reduce_sampling_rate(): void {
        let newSamplingRate = this._probabilisticSampler.samplingRate / 2.0;
        this._probabilisticSampler = new ProbabilisticSampler(newSamplingRate);
    }

    equal(other: Sampler): boolean {
        if (!(other instanceof GuaranteedThroughputSampler)) {
            return false;
        }
        return this._probabilisticSampler.equal(other._probabilisticSampler) &&
            this._lowerBoundSampler.equal(other._lowerBoundSampler) &&
            this._upperBoundRateLimiter.creditsPerSecond == other._upperBoundRateLimiter.creditsPerSecond;
    }

    close(callback: ?Function): void {
        // neither probabilistic nor rate limiting samplers allocate resources,
        // so their close methods are effectively no-op. We do not need to
        // pass the callback to them (if we did we'd need to wrap it).
        this._probabilisticSampler.close(() => {});
        this._lowerBoundSampler.close(() => {});
        if (callback) {
            callback();
        }
    }

    update(samplingRate: number, minSamplesPerSecond: number, maxSamplesPerSecond: number): boolean {
        let updated = false;
        if (this._probabilisticSampler.samplingRate != samplingRate) {
            this._probabilisticSampler = new ProbabilisticSampler(samplingRate);
            updated = true;
        }
        if (this._lowerBoundSampler.maxTracesPerSecond != minSamplesPerSecond) {
            this._lowerBoundSampler = new RateLimitingSampler(minSamplesPerSecond);
            updated = true;
        }
        if (this._upperBoundRateLimiter.creditsPerSecond != maxSamplesPerSecond) {
            this._upperBoundRateLimiter = new RateLimiter(maxSamplesPerSecond, maxSamplesPerSecond);
            updated = true;
        }
        return updated;
    }
}

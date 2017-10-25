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
import ProbabilisticSampler from './probabilistic_sampler.js';
import RateLimitingSampler from './ratelimiting_sampler.js';

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
    _tagsPlaceholder:      any;

    constructor(lowerBound: number, samplingRate: number) {
        this._probabilisticSampler =  new ProbabilisticSampler(samplingRate);
        this._lowerBoundSampler = new RateLimitingSampler(lowerBound);
        // we never let the lowerBoundSampler return its real tags, so avoid allocations
        // by reusing the same placeholder object
        this._tagsPlaceholder = {};
    }

    name(): string {
        return 'GuaranteedThroughputSampler';
    }

    toString(): string {
        return `${this.name()}(samplingRate=${this._probabilisticSampler.samplingRate}, lowerBound=${this._lowerBoundSampler.maxTracesPerSecond})`;
    }

    isSampled(operation: string, tags: any): boolean {
        if (this._probabilisticSampler.isSampled(operation, tags)) {
            // make rate limiting sampler update its budget
            this._lowerBoundSampler.isSampled(operation, this._tagsPlaceholder);
            return true;
        }
        let decision = this._lowerBoundSampler.isSampled(operation, this._tagsPlaceholder);
        if (decision) {
            tags[constants.SAMPLER_TYPE_TAG_KEY] = constants.SAMPLER_TYPE_LOWER_BOUND;
            tags[constants.SAMPLER_PARAM_TAG_KEY] = this._probabilisticSampler.samplingRate;
        }
        return decision;
    }

    equal(other: Sampler): boolean {
        if (!(other instanceof GuaranteedThroughputSampler)) {
            return false;
        }
        return this._probabilisticSampler.equal(other._probabilisticSampler) &&
            this._lowerBoundSampler.equal(other._lowerBoundSampler);
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

    update(lowerBound: number, samplingRate: number): boolean {
        let updated = false;
        if (this._probabilisticSampler.samplingRate != samplingRate) {
            this._probabilisticSampler = new ProbabilisticSampler(samplingRate);
            updated = true;
        }
        if (this._lowerBoundSampler.maxTracesPerSecond != lowerBound) {
            updated = this._lowerBoundSampler.update(lowerBound);
        }
        return updated;
    }
}

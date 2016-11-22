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

// AdaptiveSampler keeps track of all operation names is it asked to sample
// and uses GuaranteedThroughputSampler for each operation name to ensure
// that all endpoints are represented in the sampled traces. If the number
// of distinct operation names exceeds maxOperations, all other names are
// sampled with a default probabilistic sampler.
export default class AdaptiveSampler { // TODO it is not "adaptive" by itself
    _maxOperations:        number;
    _samplersByOperation:  any; // TODO does Flow understand Map?
    _defaultSampler:       ProbabilisticSampler;
    _lowerBound:           number;

    constructor(strategies: PerOperationSamplingStrategies, maxOperations: number) {
        this._maxOperations = maxOperations;
        this._samplersByOperation = {}; // TODO Object.create ?
        // TODO add stats about total zipkin v. tcollector v. jaeger spans
        strategies.perOperationStrategies.forEach((strategy) => {
            sampler = new GuaranteedThroughputSampler(
                strategies.defaultLowerBoundTracesPerSecond,
                strategy.probabilisticSampling.samplingRate // TODO why do we encapsulate the type?
            );
            this._samplersByOperation[strategy.operation] = sampler;
        });
        this._defaultSampler = new ProbabilisticSampler(strategies.defaultSamplingProbability);
        // we never let the lowerBoundSampler return its real tags, so avoid allocations
        // by reusing the same placeholder object
        this._tagsPlaceholder = {}; // TODO do we need this?
    }

    name(): string {
        return 'AdaptiveSampler';
    }

    isSampled(operation: string, tags: any): boolean {
        return false; // TODO
    }

    equal(other: Sampler): boolean {
        return false; // TODO equal should be removed
    }

    close(callback: Function): void {
        if (callback) {
            callback();
        }
    }
}

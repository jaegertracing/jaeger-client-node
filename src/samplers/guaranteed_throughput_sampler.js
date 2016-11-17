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

// GuaranteedThroughputProbabilisticSampler is a sampler that leverages both probabilisticSampler and
// rateLimitingSampler. The rateLimitingSampler is used as a guaranteed lower bound sampler such that
// every operation is sampled at least once in a time interval defined by the lowerBound. ie a lowerBound
// of 1.0 / (60 * 10) will sample an operation at least once every 10 minutes.
//
// The probabilisticSampler is given higher priority when tags are emitted, ie. if IsSampled() for both
// samplers return true, the tags for probabilisticSampler will be used.
type GuaranteedThroughputProbabilisticSampler struct {
        probabilisticSampler Sampler
        lowerBoundSampler    Sampler
        operation            string
        tags                 []Tag
        samplingRate         float64
        lowerBound           float64
}
export default class GuaranteedThroughputSampler {
    _probabilisticSampler Sampler
    _lowerBoundSampler    Sampler
    _operation            string
    _tags                 Array<Tag>
    _samplingRate         number
    _lowerBound           nunmber

    constructor(operation: string, lowerBound: number, samplingRate: number) {
        this._operation = operation;
        this._samplingRate = samplingRate;
        this._lowerBound = lowerBound;
        this._tags = {};
        this._tags[constants.SAMPLER_TYPE_TAG_KEY] = constants.SAMPLER_TYPE_LOWER_BOUND;
        this._tags[constants.SAMPLER_PARAM_TAG_KEY] = samplingRate;
        this._probabilisticSampler =  new ProbabilisticSampler(samplingRate);
    }

    name(): string {
        return 'GuaranteedThroughputSampler';
    }

    isSampled(operation: string): boolean {
        return false; // TODO
    }

    equal(other: Sampler): boolean {
        if (!(other instanceof GuaranteedThroughputSampler)) {
            return false;
        }

        return false; // TODO equal should be removed
    }

    getTags(): any {
        return this._tags;
    }

    close(callback: Function): void {
        // neither probabilistic nor rate limiting samplers allocate resources
        // so their close methods are effectively no-op, so we do not need to 
        // pass the callback to them (if we did we'd need to wrap it)
        this._probabilisticSampler.close();
        this._lowerBoundSampler.close();
        if (callback) {
            callback();
        }
    }
}

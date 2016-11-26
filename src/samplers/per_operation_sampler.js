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

import assert from 'assert';
import * as constants from '../constants.js';
import ProbabilisticSampler from './probabilistic_sampler.js';
import GuaranteedThroughputSampler from './guaranteed_throughput_sampler.js';

type SamplersByOperation = { [key: string]: GuaranteedThroughputSampler };

// PerOperationSampler keeps track of all operation names is it asked to sample
// and uses GuaranteedThroughputSampler for each operation name to ensure
// that all endpoints are represented in the sampled traces. If the number
// of distinct operation names exceeds maxOperations, all other names are
// sampled with a default probabilistic sampler.
export default class PerOperationSampler {
    _maxOperations:        number;
    _samplersByOperation:  SamplersByOperation;
    _defaultSampler:       ProbabilisticSampler;
    _defaultLowerBound:    number;

    constructor(strategies: PerOperationSamplingStrategies, maxOperations: number) {
        this._maxOperations = maxOperations;
        this._samplersByOperation = Object.create(null);
        this.update(strategies);
    }

    update(strategies: PerOperationSamplingStrategies): void {
        assert(
            typeof strategies.defaultLowerBoundTracesPerSecond === 'number',
            'expected strategies.defaultLowerBoundTracesPerSecond to be number'
        );
        assert(
            typeof strategies.defaultSamplingProbability === 'number',
            'expected strategies.defaultSamplingProbability to be number'
        );
		
        this._defaultLowerBound = strategies.defaultLowerBoundTracesPerSecond;
        strategies.perOperationStrategies.forEach((strategy) => {
            let operation = strategy.operation;
            let samplingRate = strategy.probabilisticSampling.samplingRate;
            let sampler = this._samplersByOperation[operation];
            if (sampler) {
                sampler.update(this._defaultLowerBound, samplingRate);
            }  else {
                sampler = new GuaranteedThroughputSampler(this._defaultLowerBound, samplingRate);
                this._samplersByOperation[operation] = sampler;
            }
        });
        let defaultSamplingRate = strategies.defaultSamplingProbability;
        if (!this._defaultSampler || this._defaultSampler.samplingRate != defaultSamplingRate) {
            this._defaultSampler = new ProbabilisticSampler(defaultSamplingRate);
        }
    }

    name(): string {
        return 'PerOperationSampler';
    }

    isSampled(operation: string, tags: any): boolean {
        let sampler: Sampler = this._samplersByOperation[operation];
        if (!sampler) {
            if (Object.keys(this._samplersByOperation).length >= this._maxOperations) {
                return this._defaultSampler.isSampled(operation, tags);
            }
            sampler = new GuaranteedThroughputSampler(
                this._defaultLowerBound, 
                this._defaultSampler.samplingRate
            );
            this._samplersByOperation[operation] = sampler;
        }
        return sampler.isSampled(operation, tags);
    }

    equal(other: Sampler): boolean {
        return false; // TODO equal should be removed
    }

    close(callback: Function): void {
        // all nested samplers are of simple types, so we do not need to Close them
        if (callback) {
            callback();
        }
    }
}

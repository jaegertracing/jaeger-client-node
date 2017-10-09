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

import assert from 'assert';
import * as constants from '../constants.js';
import ProbabilisticSampler from './probabilistic_sampler.js';
import GuaranteedThroughputSampler from './guaranteed_throughput_sampler.js';

type SamplersByOperation = { [key: string]: GuaranteedThroughputSampler };

// PerOperationSampler keeps track of all operation names it is asked to sample
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

    update(strategies: PerOperationSamplingStrategies): boolean {
        assert(
            typeof strategies.defaultLowerBoundTracesPerSecond === 'number',
            'expected strategies.defaultLowerBoundTracesPerSecond to be number'
        );
        assert(
            typeof strategies.defaultSamplingProbability === 'number',
            'expected strategies.defaultSamplingProbability to be number'
        );
		
        let updated: boolean = this._defaultLowerBound !== strategies.defaultLowerBoundTracesPerSecond;
        this._defaultLowerBound = strategies.defaultLowerBoundTracesPerSecond;
        strategies.perOperationStrategies.forEach((strategy) => {
            let operation = strategy.operation;
            let samplingRate = strategy.probabilisticSampling.samplingRate;
            let sampler = this._samplersByOperation[operation];
            if (sampler) {
                if (sampler.update(this._defaultLowerBound, samplingRate)) {
                    updated = true;
                }
            }  else {
                sampler = new GuaranteedThroughputSampler(this._defaultLowerBound, samplingRate);
                this._samplersByOperation[operation] = sampler;
                updated = true;
            }
        });
        let defaultSamplingRate = strategies.defaultSamplingProbability;
        if (!this._defaultSampler || this._defaultSampler.samplingRate != defaultSamplingRate) {
            this._defaultSampler = new ProbabilisticSampler(defaultSamplingRate);
            updated = true;
        }
        return updated;
    }

    name(): string {
        return 'PerOperationSampler';
    }

    toString(): string {
        return `${this.name()}(maxOperations=${this._maxOperations})`;
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

    close(callback: ?Function): void {
        // all nested samplers are of simple types, so we do not need to Close them
        if (callback) {
            callback();
        }
    }
}

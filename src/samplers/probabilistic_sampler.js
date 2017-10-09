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

export default class ProbabilisticSampler {
    _samplingRate: number;

    constructor(samplingRate: number) {
        if (samplingRate < 0.0 || samplingRate > 1.0) {
            throw new Error(`The sampling rate must be less than 0.0 and greater than 1.0. Received ${samplingRate}`);
        }

        this._samplingRate = samplingRate;
    }

    name(): string {
        return 'ProbabilisticSampler';
    }

    toString(): string {
        return `${this.name()}(samplingRate=${this._samplingRate})`;
    }

    get samplingRate(): number {
        return this._samplingRate;
    }

    isSampled(operation: string, tags: any): boolean {
        let decision = this.random() < this._samplingRate;
        if (decision) {
            tags[constants.SAMPLER_TYPE_TAG_KEY] = constants.SAMPLER_TYPE_PROBABILISTIC;
            tags[constants.SAMPLER_PARAM_TAG_KEY] = this._samplingRate;
        }
        return decision;
    }

    random(): number {
        return Math.random();
    }

    equal(other: Sampler): boolean {
        if (!(other instanceof ProbabilisticSampler)) {
            return false;
        }

        return this.samplingRate === other.samplingRate;
    }

    close(callback: ?Function): void {
        if (callback) {
            callback();
        }
    }
}

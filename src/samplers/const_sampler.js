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

export default class ConstSampler {
    _decision: boolean;

    constructor(decision: boolean) {
        this._decision = decision;
    }

    name(): string {
        return 'ConstSampler';
    }

    toString(): string {
        return `${this.name()}(${this._decision ? 'always' : 'never'})`;
    }

    get decision(): boolean {
        return this._decision;
    }

    isSampled(operation: string, tags: any): boolean {
        if (this._decision) {
            tags[constants.SAMPLER_TYPE_TAG_KEY] = constants.SAMPLER_TYPE_CONST;
            tags[constants.SAMPLER_PARAM_TAG_KEY] = this._decision;
        }
        return this._decision;
    }

    equal(other: Sampler): boolean {
        if (!(other instanceof ConstSampler)) {
            return false;
        }

        return this.decision === other.decision;
    }

    close(callback: ?Function): void {
        if (callback) {
            callback();
        }
    }
}

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

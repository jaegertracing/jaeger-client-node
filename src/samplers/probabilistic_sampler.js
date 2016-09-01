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

export default class ProbabilisticSampler {
    _samplingRate: number;

    constructor(samplingRate: number) {
        if (samplingRate < 0.0 || samplingRate > 1.0) {
            throw `The sampling rate must be less than 0.0 and grater than 1.0. Received ${samplingRate}`;
        }
        this._samplingRate = samplingRate;
    }

    isSampled(): boolean {
        return Math.random() < this._samplingRate;
    }

    get samplingRate(): number {
        return this._samplingRate;
    }

    equal(other: Sampler): boolean {
        if (!(other instanceof ProbabilisticSampler)) {
            return false;
        }

        return this.samplingRate === other.samplingRate;
    }

    close(callback: Function): void {
        if (callback) {
            callback();
        }
    }
}

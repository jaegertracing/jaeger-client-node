// @flow
// Copyright (c) 2017 Uber Technologies, Inc.
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

import BaggageSetter from '../baggage/baggage_setter.js'
import Metrics from '../metrics/metrics.js'

export const DEFAULT_MAX_VALUE_LENGTH = 2048;

/**
 * Creates a BaggageRestrictionManager that allows any baggage key.
 */
export default class DefaultBaggageRestrictionManager {
    _baggageSetter: BaggageSetter;

    constructor(metrics: Metrics, maxValueLength: ?number) {
        maxValueLength = maxValueLength || DEFAULT_MAX_VALUE_LENGTH;
        this._baggageSetter = new BaggageSetter(true, maxValueLength, metrics);
    }

    getBaggageSetter(key: string): BaggageSetter {
        return this._baggageSetter;
    }

}

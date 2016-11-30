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

import _ from 'lodash';
import LocalCounter from './counter';

export default class LocalBackend {
    _counterValues: any;
    _counterTags: any;
    _timerValues: any;
    _timerTags: any;
    _gaugeValues: any;
    _gaugeTags: any;

    constructor() {
        this.reset();
    }

    static counterEquals(counter: LocalCounter, value: number): boolean {
        let valueEqual = counter._backend._counterValues[counter._name] === value;
        let tagsEqual =  _.isEqual(counter._backend._counterTags[counter._name], counter._tags);
        return valueEqual && tagsEqual;
    }

    static counterValue(counter: LocalCounter): number {
        return counter._backend._counterValues[counter._name];
    }

    reset() {
        this._counterValues = {};
        this._counterTags = {};
        this._timerValues = {};
        this._timerTags = {};
        this._gaugeValues = {};
        this._gaugeTags = {};
    }

    increment(name: string, delta: number, tags: any): void {
        if (this._counterValues[name] === undefined) {
            this._counterValues[name] = 0;
        }
        this._counterValues[name] += delta;
        this._counterTags[name] = tags;
    }

    record(name: string, value: number, tags: any): void {
        this._timerValues[name] = value;
        this._timerTags[name] = tags;
    }

    gauge(name: string, value: number, tags: any): void {
        this._gaugeValues[name] = value;
        this._gaugeTags[name] = tags;
    }
}

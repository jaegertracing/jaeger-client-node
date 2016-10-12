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

    reset() {
        this._counterValues = {};
        this._counterTags = {};
        this._timerValues = {};
        this._timerTags = {};
        this._gaugeValues = {};
        this._gaugeTags = {};
    }

    increment(name: string, delta: number, tags: any): void {
        this._counterValues[name] = delta;
        this._counterTags[name] = tags;
    }

    timing(name: string, timestamp: number, tags: any): void {
        this._timerValues[name] = timestamp;
        this._timerTags[name] = tags;
    }

    gauge(name: string, value: number, tags: any): void {
        this._gaugeValues[name] = value;
        this._gaugeTags[name] = tags;
    }
}

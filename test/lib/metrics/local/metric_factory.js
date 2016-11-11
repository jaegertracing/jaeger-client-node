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

import LocalCounter from './counter';
import LocalGauge from './gauge';
import LocalTimer from './timer';
import LocalBackend from './backend';

export default class LocalFactory {
    _backend: any;

    constructor() {
        this._backend = new LocalBackend();
    }

    _uniqueNameWithTags(name: string, tags: any): string {
        let kvPairs = [];
        let sortedKeys = Object.keys(tags).sort();
        for (let i = 0; i < sortedKeys.length; i++) {
            let key = sortedKeys[i];
            let value = tags[key];
            if (tags.hasOwnProperty(key)) {
                kvPairs.push(`${key}=${value}`);
            }
        }

        let tagName = kvPairs.join();
        let metricName = `${name}.${tagName}`;
        return metricName;
    }

    createCounter(name: string, tags: any = {}): Counter {
        let uniqueMetricName = this._uniqueNameWithTags(name, tags);
        return new LocalCounter(uniqueMetricName, tags, this._backend);
    }

    createTimer(name: string, tags: any = {}): Timer {
        let uniqueMetricName = this._uniqueNameWithTags(name, tags);
        return new LocalTimer(uniqueMetricName, tags, this._backend);
    }

    createGauge(name: string, tags: any = {}): Gauge {
        let uniqueMetricName = this._uniqueNameWithTags(name, tags);
        return new LocalGauge(uniqueMetricName, tags, this._backend);
    }
}

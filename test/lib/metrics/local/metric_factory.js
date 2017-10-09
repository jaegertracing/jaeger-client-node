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

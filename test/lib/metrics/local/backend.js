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

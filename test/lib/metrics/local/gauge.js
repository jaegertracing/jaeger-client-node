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

export default class LocalGauge {
    _name: string;
    _tags: any;
    _backend: any;

    constructor(name: string, tags: any, backend: any) {
        this._name = name;
        this._tags = tags;
        this._backend = backend;
    }

    update(value: number): void {
        this._backend.gauge(this._name, value, this._tags);
    }
}

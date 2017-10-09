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

export default class MockLogger {
    _infoMsgs: Array<String>;
    _debugMesgs: Array<String>;
    _warnMsgs: Array<String>;
    _errorMsgs: Array<String>;

    constructor() {
        this._infoMsgs = [];
        this._debugMsgs = [];
        this._warnMsgs = [];
        this._errorMsgs = [];
    }

    info(msg: string): void {
        this._infoMsgs.push(msg);
    }

    debug(msg: string): void {
        this._debugMsgs.push(msg);
    }

    warn(msg: string): void {
        this._warnMsgs.push(msg);
    }

    error(msg: string): void {
        this._errorMsgs.push(msg);
    }

    clear(): void {
        this._infoMsgs = [];
        this._debugMsgs = [];
        this._warnMsgs = [];
        this._errorMsgs = [];
    }
}

// @flow
// Copyright (c) 2018 Uber Technologies, Inc.
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

/**
 * DefaultThrottler either throttles everything or nothing.
 */
export default class DefaultThrottler {
  _throttleAll: boolean;

  constructor(throttleAll?: boolean) {
    this._throttleAll = throttleAll || false;
  }

  isAllowed(operation: string): boolean {
    return !this._throttleAll;
  }

  setProcess(process: Process): void {
    // NOP
  }

  close(callback?: Function): void {
    if (callback) {
      callback();
    }
  }
}

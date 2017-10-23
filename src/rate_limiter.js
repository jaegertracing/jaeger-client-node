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

export default class RateLimiter {
    _creditsPerSecond: number;
    _balance: number;
    _maxBalance: number;
    _lastTick: number;

    constructor(creditsPerSecond: number, maxBalance: number, initBalance: ?number) {
        this._creditsPerSecond = creditsPerSecond;
        this._balance = initBalance || Math.random() * maxBalance;
        this._maxBalance = maxBalance;
        this._lastTick = new Date().getTime();
    }

    update(creditsPerSecond: number, maxBalance: number) {
        this._creditsPerSecond = creditsPerSecond;
        this._maxBalance = maxBalance;
        if (this._balance > maxBalance) {
            this._balance = maxBalance;
        }
    }

    checkCredit(itemCost: number): boolean {
        let currentTime: number = new Date().getTime();
        let elapsedTime: number = (currentTime - this._lastTick) / 1000;
        this._lastTick = currentTime;

        this._balance += elapsedTime * this._creditsPerSecond;
        if (this._balance > this._maxBalance) {
            this._balance = this._maxBalance;
        }
        if (this._balance >= itemCost) {
            this._balance -= itemCost;
            return true;
        }
        return false;
    }
}

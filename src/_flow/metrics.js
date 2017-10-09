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

// Counter tracks the number of times an event has occurred
declare interface Counter {
    // Adds the given value to the counter.
    increment(delta: number): void;
}

// Timer tracks how long an operation took and also computes percentiles.
declare interface Timer {
    // Records the time passed in.
    // TODO what are the units of measurement for the value?
    // TODO consider replacing this with Histogram
    record(value: number): void;
}

// Gauge returns instantaneous measurements of something as an int64 value
declare interface Gauge {
    // Update the gauge to the value passed in.
    update(value: number): void;
}

declare interface MetricsFactory {
    createCounter(name: string, tags: any): Counter;
    createTimer(name: string, tags: any): Timer;
    createGauge(name: string, tags: any): Gauge;
}

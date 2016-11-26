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

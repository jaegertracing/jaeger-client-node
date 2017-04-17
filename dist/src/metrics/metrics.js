'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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

var Metrics = function Metrics(factory) {
    _classCallCheck(this, Metrics);

    this._factory = factory;

    this.tracesStartedSampled = this._factory.createCounter('traces', {
        state: 'started',
        sampled: 'y'
    });

    this.tracesStartedNotSampled = this._factory.createCounter('traces', {
        state: 'started',
        sampled: 'n'
    });

    this.tracesJoinedSampled = this._factory.createCounter('traces', {
        state: 'joined',
        sampled: 'y'
    });

    this.tracesJoinedNotSampled = this._factory.createCounter('traces', {
        state: 'joined',
        sampled: 'n'
    });

    this.spansStarted = this._factory.createCounter('spans', {
        group: 'lifecycle',
        state: 'started'
    });

    this.spansFinished = this._factory.createCounter('spans', {
        group: 'lifecycle',
        state: 'finished'
    });

    this.spansSampled = this._factory.createCounter('spans', {
        group: 'sampling',
        sampled: 'y'
    });

    this.spansNotSampled = this._factory.createCounter('spans', {
        group: 'sampling',
        sampled: 'n'
    });

    this.decodingErrors = this._factory.createCounter('decoding-errors');

    this.reporterSuccess = this._factory.createCounter('reporter-spans', {
        state: 'success'
    });

    this.reporterFailure = this._factory.createCounter('reporter-spans', {
        state: 'failure'
    });

    this.reporterDropped = this._factory.createCounter('reporter-spans', {
        state: 'dropped'
    });

    this.reporterQueueLength = this._factory.createGauge('reporter-queue');

    this.samplerRetrieved = this._factory.createCounter('sampler', {
        state: 'retrieved'
    });

    this.samplerUpdated = this._factory.createCounter('sampler', {
        state: 'updated'
    });

    this.samplerQueryFailure = this._factory.createCounter('sampler', {
        state: 'failure',
        phase: 'query'
    });

    this.samplerParsingFailure = this._factory.createCounter('sampler', {
        state: 'failure',
        phase: 'parsing'
    });
};

exports.default = Metrics;
//# sourceMappingURL=metrics.js.map
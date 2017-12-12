'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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

    this.baggageUpdateSuccess = this._factory.createCounter('baggage-update', {
        result: 'ok'
    });

    this.baggageUpdateFailure = this._factory.createCounter('baggage-update', {
        result: 'err'
    });

    this.baggageTruncate = this._factory.createCounter('baggage-trucate');
};

exports.default = Metrics;
//# sourceMappingURL=metrics.js.map
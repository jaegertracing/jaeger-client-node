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

export default class Metrics {
  _factory: MetricsFactory;
  tracesStartedSampled: Counter;
  tracesStartedNotSampled: Counter;
  tracesJoinedSampled: Counter;
  tracesJoinedNotSampled: Counter;
  spansFinished: Counter;
  spansStartedSampled: Counter;
  spansStartedNotSampled: Counter;
  decodingErrors: Counter;
  reporterSuccess: Counter;
  reporterFailure: Counter;
  reporterDropped: Counter;
  reporterQueueLength: Gauge;
  samplerRetrieved: Counter;
  samplerUpdated: Counter;
  samplerQueryFailure: Counter;
  samplerUpdateFailure: Counter;
  baggageUpdateSuccess: Counter;
  baggageUpdateFailure: Counter;
  baggageTruncate: Counter;
  throttledDebugSpans: Counter;
  throttlerUpdateSuccess: Counter;
  throttlerUpdateFailure: Counter;

  constructor(factory: MetricsFactory) {
    this._factory = factory;

    this.tracesStartedSampled = this._factory.createCounter('jaeger:traces', {
      state: 'started',
      sampled: 'y',
    });

    this.tracesStartedNotSampled = this._factory.createCounter('jaeger:traces', {
      state: 'started',
      sampled: 'n',
    });

    this.tracesJoinedSampled = this._factory.createCounter('jaeger:traces', {
      state: 'joined',
      sampled: 'y',
    });

    this.tracesJoinedNotSampled = this._factory.createCounter('jaeger:traces', {
      state: 'joined',
      sampled: 'n',
    });

    this.spansFinished = this._factory.createCounter('jaeger:finished_spans');

    this.spansStartedSampled = this._factory.createCounter('jaeger:started_spans', {
      sampled: 'y',
    });

    this.spansStartedNotSampled = this._factory.createCounter('jaeger:started_spans', {
      sampled: 'n',
    });

    this.decodingErrors = this._factory.createCounter('jaeger:span_context_decoding_errors');

    this.reporterSuccess = this._factory.createCounter('jaeger:reporter_spans', {
      result: 'ok',
    });

    this.reporterFailure = this._factory.createCounter('jaeger:reporter_spans', {
      result: 'err',
    });

    this.reporterDropped = this._factory.createCounter('jaeger:reporter_spans', {
      result: 'dropped',
    });

    this.reporterQueueLength = this._factory.createGauge('jaeger:reporter_queue_length');

    this.samplerRetrieved = this._factory.createCounter('jaeger:sampler_queries', {
      result: 'ok',
    });

    this.samplerQueryFailure = this._factory.createCounter('jaeger:sampler_queries', {
      result: 'err',
    });

    this.samplerUpdated = this._factory.createCounter('jaeger:sampler_updates', {
      result: 'ok',
    });

    this.samplerUpdateFailure = this._factory.createCounter('jaeger:sampler_updates', {
      result: 'err',
    });

    this.baggageUpdateSuccess = this._factory.createCounter('jaeger:baggage_updates', {
      result: 'ok',
    });

    this.baggageUpdateFailure = this._factory.createCounter('jaeger:baggage_updates', {
      result: 'err',
    });

    this.baggageTruncate = this._factory.createCounter('jaeger:baggage_truncations');

    this.throttledDebugSpans = this._factory.createCounter('jaeger:throttled_debug_spans');

    this.throttlerUpdateSuccess = this._factory.createCounter('jaeger:throttler_updates', {
      result: 'ok',
    });

    this.throttlerUpdateFailure = this._factory.createCounter('jaeger:throttler_updates', {
      result: 'err',
    });
  }
}

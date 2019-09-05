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

import url from 'url';
import { SAMPLER_API_V2 } from './constants';
import { adaptSamplerOrThrow } from './_adapt_sampler';
import ProbabilisticSampler from './probabilistic_sampler';
import RateLimitingSampler from './rate_limiting_sampler';
import PerOperationSampler from './per_operation_sampler';
import Metrics from '../metrics/metrics';
import NullLogger from '../logger';
import NoopMetricFactory from '../metrics/noop/metric_factory';
import Utils from '../util';

const DEFAULT_INITIAL_SAMPLING_RATE = 0.001;
const DEFAULT_REFRESH_INTERVAL = 60000;
const DEFAULT_MAX_OPERATIONS = 2000;
const DEFAULT_SAMPLING_HOST = '0.0.0.0';
const DEFAULT_SAMPLING_PORT = 5778;
const DEFAULT_SAMPLING_PATH = '/sampling';
const PROBABILISTIC_STRATEGY_TYPE = 'PROBABILISTIC';
const RATE_LIMITING_STRATEGY_TYPE = 'RATE_LIMITING';

export default class RemoteControlledSampler implements Sampler {
  apiVersion = SAMPLER_API_V2;
  _serviceName: string;
  _sampler: Sampler;
  _logger: Logger;
  _metrics: Metrics;

  _refreshInterval: number;
  _host: string;
  _port: number;
  _samplingPath: string;
  _maxOperations: number;

  _onSamplerUpdate: ?Function;

  _initialDelayTimeoutHandle: any;
  _refreshIntervalHandle: any;

  /**
   * Creates a sampler remotely controlled by jaeger-agent.
   *
   * @param {string} [serviceName] - name of the current service / application, same as given to Tracer
   * @param {object} [options] - optional settings
   * @param {object} [options.sampler] - initial sampler to use prior to retrieving strategies from Agent
   * @param {object} [options.logger] - optional logger, see _flow/logger.js
   * @param {object} [options.metrics] - instance of Metrics object
   * @param {number} [options.refreshInterval] - interval in milliseconds before sampling strategy refreshes (0 to not refresh)
   * @param {string} [options.hostPort] - host and port for jaeger-agent, defaults to 'localhost:5778'
   * @param {string} [options.host] - host for jaeger-agent, defaults to 'localhost'
   * @param {number} [options.port] - port for jaeger-agent for SamplingManager endpoint
   * @param {string} [options.samplingPath] - path on jaeger-agent for SamplingManager endpoint
   * @param {number} [options.maxOperations] - max number of operations to track in PerOperationSampler
   * @param {function} [options.onSamplerUpdate]
   */
  constructor(serviceName: string, options: any = {}) {
    this._serviceName = serviceName;
    this._sampler = adaptSamplerOrThrow(
      options.sampler || new ProbabilisticSampler(DEFAULT_INITIAL_SAMPLING_RATE)
    );
    this._logger = options.logger || new NullLogger();
    this._metrics = options.metrics || new Metrics(new NoopMetricFactory());
    this._refreshInterval = options.refreshInterval || DEFAULT_REFRESH_INTERVAL;
    this._maxOperations = options.maxOperations || DEFAULT_MAX_OPERATIONS;
    if (options.hostPort) {
      this._parseHostPort(options.hostPort);
    } else {
      this._host = options.host || DEFAULT_SAMPLING_HOST;
      this._port = options.port || DEFAULT_SAMPLING_PORT;
    }
    this._samplingPath = options.samplingPath || DEFAULT_SAMPLING_PATH;
    this._onSamplerUpdate = options.onSamplerUpdate;

    if (options.refreshInterval !== 0) {
      let randomDelay: number = Math.random() * this._refreshInterval;
      this._initialDelayTimeoutHandle = setTimeout(this._afterInitialDelay.bind(this), randomDelay);
    }
  }

  name(): string {
    return 'RemoteSampler';
  }

  toString(): string {
    return `${this.name()}(serviceName=${this._serviceName})`;
  }

  _parseHostPort(hostPort: string) {
    hostPort = /^http/.test(hostPort) ? hostPort : `http://${hostPort}`;
    const parsedUrl = url.parse(hostPort);

    this._host = parsedUrl.hostname || DEFAULT_SAMPLING_HOST;
    this._port = parsedUrl.port ? parseInt(parsedUrl.port) : DEFAULT_SAMPLING_PORT;
  }

  _afterInitialDelay(): void {
    this._refreshIntervalHandle = setInterval(
      this._refreshSamplingStrategy.bind(this),
      this._refreshInterval
    );
    this._initialDelayTimeoutHandle = null;
  }

  _refreshSamplingStrategy() {
    let serviceName: string = encodeURIComponent(this._serviceName);
    const success: Function = body => {
      this._handleSamplingServerResponse(body);
    };
    const error: Function = err => {
      this._logger.error(`Error in fetching sampling strategy: ${err}.`);
      this._metrics.samplerQueryFailure.increment(1);
    };
    Utils.httpGet(this._host, this._port, `${this._samplingPath}?service=${serviceName}`, success, error);
  }

  _handleSamplingServerResponse(body: string) {
    this._metrics.samplerRetrieved.increment(1);
    let strategy;
    try {
      strategy = JSON.parse(body);
      if (!strategy) {
        throw 'Malformed response: ' + body;
      }
    } catch (error) {
      this._logger.error(`Error in parsing sampling strategy: ${error}.`);
      this._metrics.samplerUpdateFailure.increment(1);
      return;
    }
    try {
      if (this._updateSampler(strategy)) {
        this._metrics.samplerUpdated.increment(1);
      }
    } catch (error) {
      this._logger.error(`Error in updating sampler: ${error}.`);
      this._metrics.samplerUpdateFailure.increment(1);
      return;
    }
    if (this._onSamplerUpdate) {
      this._onSamplerUpdate(this._sampler);
    }
  }

  _updateSampler(response: SamplingStrategyResponse): boolean {
    if (response.operationSampling) {
      if (this._sampler instanceof PerOperationSampler) {
        let sampler: PerOperationSampler = this._sampler;
        return sampler.update(response.operationSampling);
      }
      this._sampler = new PerOperationSampler(response.operationSampling, this._maxOperations);
      return true;
    }
    if (response.strategyType === PROBABILISTIC_STRATEGY_TYPE && response.probabilisticSampling) {
      let samplingRate = response.probabilisticSampling.samplingRate;
      if (this._sampler instanceof ProbabilisticSampler) {
        return this._sampler.update(samplingRate);
      }
      this._sampler = new ProbabilisticSampler(samplingRate);
      return true;
    }
    if (response.strategyType === RATE_LIMITING_STRATEGY_TYPE && response.rateLimitingSampling) {
      let maxTracesPerSecond = response.rateLimitingSampling.maxTracesPerSecond;
      if (this._sampler instanceof RateLimitingSampler) {
        let sampler: RateLimitingSampler = this._sampler;
        return sampler.update(maxTracesPerSecond);
      }
      this._sampler = new RateLimitingSampler(maxTracesPerSecond);
      return true;
    }

    throw 'Malformed response: ' + JSON.stringify(response);
  }

  onCreateSpan(span: Span): SamplingDecision {
    return this._sampler.onCreateSpan(span);
  }

  onSetOperationName(span: Span, operationName: string): SamplingDecision {
    return this._sampler.onSetOperationName(span, operationName);
  }

  onSetTag(span: Span, key: string, value: any): SamplingDecision {
    return this._sampler.onSetTag(span, key, value);
  }

  close(callback: ?Function): void {
    clearTimeout(this._initialDelayTimeoutHandle);
    clearInterval(this._refreshIntervalHandle);

    if (callback) {
      callback();
    }
  }
}

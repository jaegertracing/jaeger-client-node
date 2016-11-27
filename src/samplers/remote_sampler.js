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

import request from 'request';
import ProbabilisticSampler from './probabilistic_sampler.js';
import RateLimitingSampler from './ratelimiting_sampler.js';
import PerOperationSampler from './per_operation_sampler.js';
import Metrics from '../metrics/metrics.js';
import NullLogger from '../logger.js';
import NoopMetricFactory from '../metrics/noop/metric_factory';

const DEFAULT_INITIAL_SAMPLING_RATE = 0.001;
const DEFAULT_REFRESH_INTERVAL = 60000;
const DEFAULT_MAX_OPERATIONS = 2000;
const DEFAULT_SAMPLING_HOST = '0.0.0.0';
const DEFAULT_SAMPLING_PORT = 5778;
const PROBABILISTIC_STRATEGY_TYPE = 0;
const RATELIMITING_STRATEGY_TYPE = 1;

export default class RemoteControlledSampler {

    _serviceName: string;
    _sampler: Sampler;
    _logger: Logger;
    _metrics: Metrics;

    _refreshInterval: number;
    _host: string;
    _port: number;
    _maxOperations: number;

    _onSamplerUpdate: Function;

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
     * @param {number} [refreshInterval] - interval in milliseconds before sampling strategy refreshes (0 to not refresh)
     * @param {string} [host] - host for jaeger-agent, defaults to 'localhost'
     * @param {number} [port] - port for jaeger-agent for SamplingManager endpoint
     * @param {number} [maxOperations] - max number of operations to track in PerOperationSampler
     * @param {function} [onSamplerUpdate]
     */
    constructor(serviceName: string, options: any = {}) {
        this._serviceName = serviceName;
        this._sampler = options.sampler || new ProbabilisticSampler(DEFAULT_INITIAL_SAMPLING_RATE);
        this._logger = options.logger || new NullLogger();
        this._metrics = options.metrics || new Metrics(new NoopMetricFactory());
        this._refreshInterval = options.refreshInterval || DEFAULT_REFRESH_INTERVAL;
        this._host = options.host || DEFAULT_SAMPLING_HOST;
        this._port = options.port || DEFAULT_SAMPLING_PORT;
        this._maxOperations = options.maxOperations || DEFAULT_MAX_OPERATIONS;

        this._onSamplerUpdate = options.onSamplerUpdate || function onSamplerUpdate(sampler: Sampler) {};

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

    _afterInitialDelay(): void {
        this._refreshIntervalHandle = setInterval(
            this._refreshSamplingStrategy.bind(this),
            this._refreshInterval
        );
    }

    _refreshSamplingStrategy() {
        let serviceName: string = encodeURIComponent(this._serviceName);
        let url: string = `http://${this._host}:${this._port}/?service=${serviceName}`;
        request.get(url, (err, response) => {
            if (err) {
                this._logger.error(`Error in fetching sampling strategy from ${url}: ${err}.`);
                this._metrics.samplerQueryFailure.increment(1);
                return;
            }
            this._metrics.samplerRetrieved.increment(1);
            let strategy;
            try {
                strategy = JSON.parse(response.body);
            } catch (error) {
                this._logger.error(`Error in parsing sampling strategy: ${error}.`);
                this._metrics.samplerParsingFailure.increment(1);
                return;
            }
            if (strategy) {
                try {
                    if (this._updateSampler(strategy)) {
                        this._metrics.samplerUpdated.increment(1);
                        this._onSamplerUpdate(this._sampler);
                    }
                } catch (error) {
                    this._logger.error(`Error in updating sampler: ${error}.`);
                    this._metrics.samplerParsingFailure.increment(1);
                }
            }
        });
    }

    _updateSampler(response: ?SamplingStrategyResponse): boolean {
        if (typeof(this._sampler) instanceof PerOperationSampler) {
            this._sampler.update(response);
            return true;
        }
        if (response.operationSampling) {
            this._sampler = new PerOperationSampler(response.operationSampling, this._maxOperations);
            return true;
        }
        let newSampler: Sampler;
        if (response.strategyType === PROBABILISTIC_STRATEGY_TYPE && response.probabilisticSampling) {
            let samplingRate = response.probabilisticSampling.samplingRate;
            newSampler = new ProbabilisticSampler(samplingRate);
        } else if (response.strategyType === RATELIMITING_STRATEGY_TYPE && response.rateLimitingSampling) {
            let maxTracesPerSecond = response.rateLimitingSampling.maxTracesPerSecond;
            newSampler = new RateLimitingSampler(maxTracesPerSecond);
        } else {
            throw 'Malformed response: ' + JSON.stringify({error: response});
        }

        if (newSampler && (!this._sampler.equal(newSampler))) {
            this._sampler = newSampler;
            return true;
        }
        return false;
    }


    isSampled(operation: string, tags: any): boolean {
        return this._sampler.isSampled(operation, tags);
    }

    close(callback: Function): void {
        clearTimeout(this._initialDelayTimeoutHandle);
        clearInterval(this._refreshIntervalHandle);

        if (callback) {
            callback();
        }
    }
}

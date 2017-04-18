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

import http from 'http';
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
     * @param {string} [options.host] - host for jaeger-agent, defaults to 'localhost'
     * @param {number} [options.port] - port for jaeger-agent for SamplingManager endpoint
     * @param {number} [options.maxOperations] - max number of operations to track in PerOperationSampler
     * @param {function} [options.onSamplerUpdate]
     */
    constructor(serviceName: string, options: any = {}) {
        this._serviceName = serviceName;
        this._sampler = options.sampler || new ProbabilisticSampler(DEFAULT_INITIAL_SAMPLING_RATE);
        this._logger = options.logger || new NullLogger();
        this._metrics = new Metrics(new NoopMetricFactory());
        this._refreshInterval = options.refreshInterval || DEFAULT_REFRESH_INTERVAL;
        this._host = options.host || DEFAULT_SAMPLING_HOST;
        this._port = options.port || DEFAULT_SAMPLING_PORT;
        this._maxOperations = options.maxOperations || DEFAULT_MAX_OPERATIONS;

        this._onSamplerUpdate = options.onSamplerUpdate;

        this._logger.error(`JAEGER: Refresh interval is ${options.refreshInterval}`);

        if (options.refreshInterval !== 0) {
            this._logger.error(`JAEGER: Random delay start`);
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
        this._logger.error(`JAEGER: refreshSamplingStrategy`);
        let serviceName: string = encodeURIComponent(this._serviceName);
        http.get({
            'host': this._host,
            'port': this._port,
            'path': `/sampling?service=${serviceName}`
        }, (res) => {
            // explicitly treat incoming data as utf8 (avoids issues with multi-byte chars)
            res.setEncoding('utf8');

            // incrementally capture the incoming response body
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });


            res.on('end', () => {
                this._logger.error(`JAEGER: retrieved sampling strategy from agent`, body);
                this._logger.error(`JAEGER: service is: ${serviceName}`);
                this._parseSamplingServerResponse(body);
            });
        }).on('error', (err) => {
            this._logger.error(`Error in fetching sampling strategy: ${err}.`);
            this._metrics.samplerQueryFailure.increment(1);
        });
    }

    _parseSamplingServerResponse(body: string) {
        this._logger.error(`JAEGER: parseSamplingServerResponse`);
        this._logger.error(`JAEGER: a`);
        this._metrics.samplerRetrieved.increment(1);
        this._logger.error(`JAEGER: b`);
        let strategy;
        this._logger.error(`JAEGER: parseSamplingServerResponse TRY 1`);
        try {
            strategy = JSON.parse(body);
            if (!strategy) {
                this._logger.error(`JAEGER: Malformed response!!!!!!!`);
                throw 'Malformed response: ' + body;
            }
        } catch (error) {
            this._logger.error(`Error in parsing sampling strategy: ${error}.`);
            this._metrics.samplerParsingFailure.increment(1);
            return;
        }
        this._logger.error(`JAEGER: TRY 1 PASS`);
        this._logger.error(`JAEGER: TRY 2`);
        this._logger.error(`JAEGER: PRE sampler: ${this._sampler.toString()}.`);
        try {
            if (this._updateSampler(strategy)) {
                this._metrics.samplerUpdated.increment(1);
            }
        } catch (error) {
            this._logger.error(`Error in updating sampler: ${error}.`);
            this._metrics.samplerParsingFailure.increment(1);
            return;
        }
        this._logger.error(`JAEGER: TRY 2 PASS`);
        this._logger.error(`JAEGER: POST sampler: ${this._sampler.toString()}.`);
        if (this._onSamplerUpdate) {
            this._onSamplerUpdate(this._sampler);
        }
    }

    _updateSampler(response: SamplingStrategyResponse): boolean {
        this._logger.error(`JAEGER: updateSampler.`);
        if (response.operationSampling) {
            if (this._sampler instanceof PerOperationSampler) {
                let sampler: PerOperationSampler = this._sampler;
                return sampler.update(response.operationSampling);
            }
            this._sampler = new PerOperationSampler(response.operationSampling, this._maxOperations);
            return true;
        }
        let newSampler: Sampler;
        this._logger.error(`JAEGER: updateSampler TRY`);
        this._logger.error(`JAEGER: updateSampler response: ${response.strategyType}`);
        if ((response.strategyType === PROBABILISTIC_STRATEGY_TYPE || response.strategyType === 'PROBABILISTIC') && response.probabilisticSampling) {
            let samplingRate = response.probabilisticSampling.samplingRate;
            this._logger.error(`JAEGER: probabilisticSampler: ${samplingRate.toString()}.`);
            newSampler = new ProbabilisticSampler(samplingRate);
        } else if (response.strategyType === RATELIMITING_STRATEGY_TYPE && response.rateLimitingSampling) {
            let maxTracesPerSecond = response.rateLimitingSampling.maxTracesPerSecond;
            this._logger.error(`JAEGER: rateLimitingSampler ${maxTracesPerSecond.toString()}.`);
            newSampler = new RateLimitingSampler(maxTracesPerSecond);
        } else {
            this._logger.error(`JAEGER: updateSampler Malformed response`);
            throw 'Malformed response: ' + JSON.stringify(response);
        }
        this._logger.error(`JAEGER: updateSampler End`);
        this._logger.error(`JAEGER: new Sampler: ${newSampler.toString()}.`);

        if (this._sampler.equal(newSampler)) {
            this._logger.error(`JAEGER: Not updating sampler`);
            return false;
        }
        this._logger.error(`JAEGER: Updating sampler`);
        this._sampler = newSampler;
        return true;
    }


    isSampled(operation: string, tags: any): boolean {
        return this._sampler.isSampled(operation, tags);
    }

    close(callback: ?Function): void {
        clearTimeout(this._initialDelayTimeoutHandle);
        clearInterval(this._refreshIntervalHandle);

        if (callback) {
            callback();
        }
    }
}

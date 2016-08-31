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
import NullLogger from '../logger.js';

const DEFAULT_INITIAL_SAMPLING_RATE = 0.001;
const SAMPLING_REFRESH_INTERVAL = 60000;
const DEFAULT_SAMPLING_HOST = '0.0.0.0';
const DEFAULT_SAMPLING_PORT = 5778;
const PROBABILISTIC_STRATEGY_TYPE = 0;
const RATELIMITING_STRATEGY_TYPE = 1;

export default class RemoteControlledSampler {

    _sampler: Sampler;
    _callerName: string;
    _logger: any;
    _host: string;
    _port: number;
    _timeoutHandle: any;
    _intervalHandle: any;
    _onSamplerUpdate: Function;
    _refreshInterval: number;

    constructor(callerName: string,
                options: any) {

        this._callerName = callerName;
        this._sampler = options.sampler || new ProbabilisticSampler(DEFAULT_INITIAL_SAMPLING_RATE);
        this._logger = options.logger || new NullLogger();
        this._refreshInterval = options.refreshInterval || SAMPLING_REFRESH_INTERVAL;

        let randomDelay: number = Math.random() * this._refreshInterval;
        this._onSamplerUpdate = options.onSamplerUpdate;
        this._host = options.host || DEFAULT_SAMPLING_HOST;
        this._port = options.port || DEFAULT_SAMPLING_PORT;

        // setTimeout and setInterval have delays, so for testing purposes I allow an alternative path
        // that immediately executes the _refreshSamplingStrategy
        if (options.firstRefreshDelay) {
            this._timeoutHandle = setTimeout(() => {
                this._intervalHandle = setInterval(this._refreshSamplingStrategy.bind(this), this._refreshInterval);
            }, randomDelay)

        } else {
            this._refreshSamplingStrategy();
        }
    }

    _refreshSamplingStrategy() {
        this._getSamplingStrategy(this._callerName);
    }

    _getSamplingStrategy(callerName: string): ?SamplingStrategyResponse  {
        let encodedCaller: string = encodeURIComponent(callerName);
        request.get(`http:\/\/${this._host}:${this._port}/?service=${encodedCaller}`, (err, response) => {
            if (err) {
                this._logger.error('Error in fetching sampling strategy.');
                return null;
            }

            let strategy = JSON.parse(response.body);
            this._setSampler(strategy);
        });
    }

    _setSampler(strategy: ?SamplingStrategyResponse): void {
        if (!strategy) {
            return;
        }

        let newSampler;
        if (strategy.strategyType === PROBABILISTIC_STRATEGY_TYPE && strategy.probabilisticSampling) {
            let samplingRate = strategy.probabilisticSampling.samplingRate;
            newSampler = new ProbabilisticSampler(samplingRate);
        } else if (strategy.strategyType === RATELIMITING_STRATEGY_TYPE && strategy.rateLimitingSampling) {
            let maxTracesPerSecond = strategy.rateLimitingSampling.maxTracesPerSecond;
            newSampler = new RateLimitingSampler(maxTracesPerSecond);
        } else {
            this._logger.error('Unrecognized strategy type: ' + JSON.stringify({error: strategy}));
        }

        if (newSampler && (!this._sampler.equal(newSampler))) {
            this._sampler = newSampler;
        }

        if (this._onSamplerUpdate) {
            this._onSamplerUpdate(this._sampler);
        }
    }


    isSampled(): boolean {
        return this._sampler.isSampled();
    }

    close(callback: Function): void {
        clearTimeout(this._timeoutHandle);
        clearInterval(this._intervalHandle);

        if (callback) {
            callback();
        }
    }
}

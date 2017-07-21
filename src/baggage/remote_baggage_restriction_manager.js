// @flow
// Copyright (c) 2017 Uber Technologies, Inc.
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

import Metrics from '../metrics/metrics.js';
import NullLogger from '../logger.js';
import NoopMetricFactory from '../metrics/noop/metric_factory';
import * as constants from './default_baggage_restriction_manager';
import Utils from '../util.js';

const DEFAULT_REFRESH_INTERVAL = 60000;
const DEFAULT_BAGGAGE_HOST = '0.0.0.0';
const DEFAULT_BAGGAGE_PORT = 5778;
const DEFAULT_FAIL_CLOSED = false;

export default class RemoteBaggageRestrictionManager {

    _serviceName: string;
    _logger: Logger;
    _metrics: Metrics;

    _refreshInterval: number;
    _host: string;
    _port: number;
    _failClosed: boolean;
    _restrictionsMap: { [key: string]: number };

    _initialDelayTimeoutHandle: any;
    _refreshIntervalHandle: any;
    _onRestrictionsUpdate: ?Function;

    _initialized: boolean;

    /**
     * Creates a BaggageRestrictionManager that fetches baggage restrictions remotely from jaeger-agent.
     *
     * @param {string} [serviceName] - name of the current service / application, same as given to Tracer
     * @param {object} [options] - optional settings
     * @param {object} [options.logger] - optional logger, see _flow/logger.js
     * @param {object} [options.failClosed] - this determines the startup failure mode of RemoteBaggageRestrictionManager.
     * If failClosed is true, RemoteBaggageRestrictionManager will not allow any baggage to be written until baggage restrictions
     * have been retrieved from agent. If failClosed is false (ie FailOpen), RemoteBaggageRestrictionManager will allow any baggage
     * to be written until baggage restrictions have been retrieved from agent.
     * @param {object} [options.metrics] - instance of Metrics object
     * @param {number} [options.refreshInterval] - interval in milliseconds before baggage restrictions refreshes (0 to not refresh)
     * @param {string} [options.host] - host for jaeger-agent, defaults to 'localhost'
     * @param {number} [options.port] - port for jaeger-agent for BaggageRestrictionManager endpoint
     * @param {function} [options.onRestrictionsUpdate]
     */
    constructor(serviceName: string, options: any = {}) {
        this._serviceName = serviceName;
        this._logger = options.logger || new NullLogger();
        this._metrics = options.metrics || new Metrics(new NoopMetricFactory());
        this._refreshInterval = options.refreshInterval || DEFAULT_REFRESH_INTERVAL;
        this._host = options.host || DEFAULT_BAGGAGE_HOST;
        this._port = options.port || DEFAULT_BAGGAGE_PORT;
        this._failClosed = options.failClosed || DEFAULT_FAIL_CLOSED;
        this._restrictionsMap = {};
        this._initialized = false;
        this._onRestrictionsUpdate = options.onRestrictionsUpdate;

        this._refreshBaggageRestrictions();

        if (options.refreshInterval !== 0) {
            let randomDelay: number = Math.random() * this._refreshInterval;
            this._initialDelayTimeoutHandle = setTimeout(this._afterInitialDelay.bind(this), randomDelay);
        }
    }

    isValidBaggageKey(key: string): [boolean, number] {
        if (!this._initialized) {
            if (this._failClosed) {
                return [false, 0];
            }
            return [true, constants.DEFAULT_MAX_VALUE_LENGTH];
        }
        if (key in this._restrictionsMap) {
            return [true, this._restrictionsMap[key]]
        }
        return [false, 0];
    }

    _afterInitialDelay(): void {
        this._refreshIntervalHandle = setInterval(
            this._refreshBaggageRestrictions.bind(this),
            this._refreshInterval
        );
    }

    _refreshBaggageRestrictions() {
        let serviceName: string = encodeURIComponent(this._serviceName);
        let success: Function = (body) => {
            this._parseBaggageRestrictionServerResponse(body);
        };
        let error: Function = (err) => {
            this._logger.error(`Error in fetching baggage restrictions: ${err}.`);
            this._metrics.baggageRestrictionsUpdateFailure.increment(1);
        };
        Utils.httpGet(this._host, this._port, `/baggageRestrictions?service=${serviceName}`, success, error);
    }

    _parseBaggageRestrictionServerResponse(body: string) {
        let restrictions;
        try {
            restrictions = JSON.parse(body);
            if (!restrictions) {
                throw 'Malformed response: ' + body;
            }
        } catch (error) {
            this._logger.error(`Error in parsing baggage restrictions: ${error}.`);
            this._metrics.baggageRestrictionsUpdateFailure.increment(1);
            return;
        }
        try {
            this._updateRestrictions(restrictions);
            this._initialized = true;
            this._metrics.baggageRestrictionsUpdateSuccess.increment(1);
        } catch (error) {
            this._logger.error(`Error in updating baggage restrictions: ${error}.`);
            this._metrics.baggageRestrictionsUpdateFailure.increment(1);
            return;
        }
        if (this._onRestrictionsUpdate) {
            this._onRestrictionsUpdate(this);
        }
    }

    _updateRestrictions(restrictions: Array<BaggageRestriction>) {
        let restrictionsMap: { [key: string]: number } = {};
        restrictions.forEach((restriction) => {
            restrictionsMap[restriction.baggageKey] = restriction.maxValueLength;
        });
        this._restrictionsMap = restrictionsMap;
    }

    close(callback: ?Function): void {
        clearTimeout(this._initialDelayTimeoutHandle);
        clearInterval(this._refreshIntervalHandle);

        if (callback) {
            callback();
        }
    }
}

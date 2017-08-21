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
import Restriction from "./restriction";

const DEFAULT_REFRESH_INTERVAL_MS = 60000;
const DEFAULT_INITIAL_DELAY_MS = 0;
const DEFAULT_BAGGAGE_HOST = '0.0.0.0';
const DEFAULT_BAGGAGE_PORT = 5778;
const DEFAULT_DENY_BAGGAGE_ON_INITIALIZATION_FAILURE = false;

export default class RemoteBaggageRestrictionManager {

    _serviceName: string;
    _logger: Logger;
    _metrics: Metrics;

    _refreshIntervalMs: number;
    _host: string;
    _port: number;
    _denyBaggageOnInitializationFailure: boolean;
    _restrictions: Map<string, Restriction>;
    _invalidRestriction: Restriction;
    _validRestriction: Restriction;

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
     * @param {object} [options.denyBaggageOnInitializationFailure] - this determines the startup failure mode of
     * RemoteBaggageRestrictionManager. If denyBaggageOnInitializationFailure is true, the manager will not allow any
     * baggage to be written until baggage restrictions have been retrieved from agent. If false the manager will allow
     * any baggage to be written until baggage restrictions have been retrieved from agent.
     * @param {object} [options.metrics] - instance of Metrics object
     * @param {number} [options.refreshIntervalMs] - interval in milliseconds that determines how often baggage
     * restrictions are fetched (0 to not refresh)
     * @param {number} [options.initialDelayMs] - interval in milliseconds that determines how soon after initialization
     * baggage restrictions are first fetched. This default to 0 and is exposed for testing purposes.
     * (0 to not refresh)
     * @param {string} [options.host] - host for jaeger-agent, defaults to 'localhost'
     * @param {number} [options.port] - port for jaeger-agent for BaggageRestrictionManager endpoint
     * @param {function} [options.onRestrictionsUpdate]
     */
    constructor(serviceName: string, options: any = {}) {
        this._serviceName = serviceName;
        this._logger = options.logger || new NullLogger();
        this._metrics = options.metrics || new Metrics(new NoopMetricFactory());
        this._refreshIntervalMs = options.refreshIntervalMs || DEFAULT_REFRESH_INTERVAL_MS;
        this._host = options.host || DEFAULT_BAGGAGE_HOST;
        this._port = options.port || DEFAULT_BAGGAGE_PORT;
        this._denyBaggageOnInitializationFailure =
            options.failClosed || DEFAULT_DENY_BAGGAGE_ON_INITIALIZATION_FAILURE;
        this._restrictions = new Map();
        this._initialized = false;
        this._onRestrictionsUpdate = options.onRestrictionsUpdate;

        this._invalidRestriction = new Restriction(false, 0);
        this._validRestriction = new Restriction(true, constants.DEFAULT_MAX_VALUE_LENGTH);

        this._initialDelayTimeoutHandle = setTimeout(this._afterInitialDelay.bind(this),
            options.initialDelayMs || DEFAULT_INITIAL_DELAY_MS);
    }

    getRestriction(service:string, key: string): Restriction {
        if (!this._initialized) {
            if (this._denyBaggageOnInitializationFailure) {
                return this._invalidRestriction;
            }
            return this._validRestriction;
        }
        let restriction = this._restrictions.get(key);
        if (restriction) {
            return restriction;
        }
        return this._invalidRestriction;
    }

    _afterInitialDelay(): void {
        this._refreshBaggageRestrictions();
        this._refreshIntervalHandle = setInterval(
            this._refreshBaggageRestrictions.bind(this),
            this._refreshIntervalMs
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
        let restrictionsMap: Map<string, Restriction> = new Map();
        restrictions.forEach((restriction) => {
            restrictionsMap.set(restriction.baggageKey, new Restriction(true, restriction.maxValueLength));
        });
        this._restrictions = restrictionsMap;
    }

    isReady(): boolean {
        return this._initialized;
    }

    close(callback: ?Function): void {
        clearTimeout(this._initialDelayTimeoutHandle);
        clearInterval(this._refreshIntervalHandle);

        if (callback) {
            callback();
        }
    }
}

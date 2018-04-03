// @flow
// Copyright (c) 2018 Uber Technologies, Inc.
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
import Utils from '../util.js';

const DEFAULT_REFRESH_INTERVAL_MS = 5000;
const DEFAULT_INITIAL_DELAY_MS = 5000;
const DEFAULT_THROTTLER_HOST = '0.0.0.0';
const DEFAULT_THROTTLER_PORT = 5778;

// minimumCredits is the minimum amount of credits necessary to not be throttled.
// i.e. if currentCredits > MINIMUM_CREDITS, then the operation will not be throttled.
const MINIMUM_CREDITS = 1.0;

type CreditsPerOperation = { [key: string]: number };

export default class RemoteThrottler {
  _serviceName: string;
  _logger: Logger;
  _metrics: Metrics;

  _refreshIntervalMs: number;
  _host: string;
  _port: number;

  _uuid: string;
  _credits: CreditsPerOperation;

  _initialDelayTimeoutHandle: any;
  _refreshIntervalHandle: any;
  _onCreditsUpdate: ?Function;

  /**
   * Creates a RemoteThrottler that fetches credits remotely from jaeger-agent.
   *
   * @param {string} [serviceName] - name of the current service / application, same as given to Tracer
   * @param {object} [options] - optional settings
   * @param {object} [options.logger] - optional logger, see _flow/logger.js
   * @param {object} [options.metrics] - instance of Metrics object
   * @param {number} [options.refreshIntervalMs] - interval in milliseconds that determines how often credits
   * are fetched (0 to not refresh, NOT RECOMMENDED!)
   * @param {number} [options.initialDelayMs] - interval in milliseconds that determines how soon after initialization
   * credits are first fetched (0 to not refresh, NOT RECOMMENDED!).
   * @param {string} [options.host] - host for jaeger-agent, defaults to 'localhost'
   * @param {number} [options.port] - port for jaeger-agent for /credits endpoint
   * @param {function} [options.onCreditsUpdate] - callback function once credits are updated. Used for testing.
   */
  constructor(serviceName: string, options: any = {}) {
    this._serviceName = serviceName;
    this._logger = options.logger || new NullLogger();
    this._metrics = options.metrics || new Metrics(new NoopMetricFactory());
    this._refreshIntervalMs = options.refreshIntervalMs || DEFAULT_REFRESH_INTERVAL_MS;
    this._host = options.host || DEFAULT_THROTTLER_HOST;
    this._port = options.port || DEFAULT_THROTTLER_PORT;

    this._credits = Object.create(null);
    this._onCreditsUpdate = options.onCreditsUpdate;

    this._initialDelayTimeoutHandle = setTimeout(
      this._afterInitialDelay.bind(this),
      options.initialDelayMs || DEFAULT_INITIAL_DELAY_MS
    );
  }

  _afterInitialDelay(): void {
    this._refreshCredits();
    this._refreshIntervalHandle = setInterval(this._refreshCredits.bind(this), this._refreshIntervalMs);
  }

  setProcess(process: Process): void {
    this._uuid = process.uuid || '';
  }

  isAllowed(operation: string): boolean {
    if (operation in this._credits) {
      // TODO if credits is 0, is this false? Do I need to do an explicit check on undefined?
      return this._isAllowed(operation);
    }
    this._credits[operation] = 0;
    // If seen for the first time, async fetch credits
    this._refreshCredits();
    return false;
  }

  _isAllowed(operation: string): boolean {
    // N.B. The -1 assignment is necessary, otherwise we need to type credits as ?number which
    // becomes a bit of a headache in this function because flow will throw errors on credits
    // being null even if I explicitly check it's not before continuing.
    let credits: number = operation in this._credits ? this._credits[operation] : 0;
    if (credits < MINIMUM_CREDITS) {
      return false;
    }
    this._credits[operation] = credits - MINIMUM_CREDITS;
    return true;
  }

  _refreshCredits() {
    if (!this._uuid) {
      this._logger.error(`UUID must be set to fetch credits`);
      return;
    }
    if (Object.keys(this._credits).length == 0) {
      // No point fetching credits if there's no operations to fetch
      return;
    }
    this._fetchCredits(Object.keys(this._credits));
  }

  _incrementCredits(creditResponses: Array<CreditResponse>) {
    creditResponses.forEach(r => {
      this._credits[r.operation] = this._credits[r.operation] + r.credits;
    });
  }

  _fetchCredits(operations: any) {
    let serviceName: string = encodeURIComponent(this._serviceName);
    let uuid: string = encodeURIComponent(this._uuid);
    let url: string = `/credits?service=${serviceName}&uuid=${uuid}`;

    operations.forEach(operation => {
      url = url + `&operation=${encodeURIComponent(operation)}`;
    });

    let success: Function = body => {
      this._parseCreditResponse(body);
    };
    let error: Function = err => {
      this._logger.error(`Error in fetching credits: ${err}.`);
      this._metrics.throttlerUpdateFailure.increment(1);
    };
    Utils.httpGet(this._host, this._port, url, success, error);
  }

  _parseCreditResponse(body: string) {
    let creditResponses;
    try {
      creditResponses = JSON.parse(body);
      if (!creditResponses) {
        throw 'Malformed response: ' + body;
      }
    } catch (error) {
      this._logger.error(`Error in parsing credit response: ${error}.`);
      this._metrics.throttlerUpdateFailure.increment(1);
      return;
    }
    try {
      this._incrementCredits(creditResponses);
      this._metrics.throttlerUpdateSuccess.increment(1);
    } catch (error) {
      this._logger.error(`Error in updating credits: ${error}.`);
      this._metrics.throttlerUpdateFailure.increment(1);
      return;
    }
    if (this._onCreditsUpdate) {
      this._onCreditsUpdate(this);
    }
  }

  close(callback: ?Function): void {
    clearTimeout(this._initialDelayTimeoutHandle);
    clearInterval(this._refreshIntervalHandle);

    if (callback) {
      callback();
    }
  }
}

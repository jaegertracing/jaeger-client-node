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

import { assert } from 'chai';
import Metrics from '../../src/metrics/metrics.js';
import MockLogger from '../lib/mock_logger';
import ConfigServer from '../lib/config_server';
import LocalMetricFactory from '../lib/metrics/local/metric_factory.js';
import LocalBackend from '../lib/metrics/local/backend.js';
import RemoteThrottler from '../../src/throttler/remote_thottler';

describe('RemoteThrottler should', () => {
  let server: ConfigServer;
  let logger: MockLogger;
  let metrics: Metrics;
  let throttler: RemoteThrottler;
  let serviceName = 'service';
  let operation = 'op';
  let other_operation = 'oop';
  let uuid = 'uuid';

  before(() => {
    server = new ConfigServer().start();
  });

  after(() => {
    server.close();
  });

  beforeEach(() => {
    server.clearConfigs();
    logger = new MockLogger();
    metrics = new Metrics(new LocalMetricFactory());
    throttler = new RemoteThrottler(serviceName, {
      refreshIntervalMs: 0,
      initialDelayMs: 60000,
      metrics: metrics,
      logger: logger,
    });
  });

  afterEach(() => {
    throttler.close();
  });

  it('return false for isAllowed on initial call and return true once credits are initialized', done => {
    throttler.setProcess({ uuid: uuid });
    server.addCredits(serviceName, [{ operation: operation, credits: 3 }]);
    throttler._onCreditsUpdate = _throttler => {
      assert.isOk(_throttler.isAllowed(operation));
      assert.equal(_throttler._credits.get(operation), 2);
      assert.equal(LocalBackend.counterValue(metrics.throttlerUpdateSuccess), 1);
      done();
    };
    assert.isNotOk(throttler.isAllowed(operation));
  });

  it('log an error if _refreshCredits is called prior to UUID being set', () => {
    throttler._refreshCredits();
    assert.equal(logger._errorMsgs.length, 1);
  });

  it("return false for _isAllowed if operation isn't in _credits", () => {
    assert.isNotOk(throttler._isAllowed(operation));
  });

  it("return false for isAllowed if operation doesn't have enough credits", () => {
    throttler._credits.set(operation, 0.5);
    assert.isNotOk(throttler._isAllowed(operation));
  });

  it('succeed when we retrieve credits for multiple operations', done => {
    throttler.setProcess({ uuid: uuid });
    server.addCredits(serviceName, [
      { operation: operation, credits: 5 },
      { operation: other_operation, credits: 3 },
    ]);
    throttler._credits.set(operation, 0);
    throttler._credits.set(other_operation, 0);
    throttler._onCreditsUpdate = _throttler => {
      assert.isOk(_throttler.isAllowed(operation));
      assert.equal(_throttler._credits.get(operation), 4);
      assert.isOk(_throttler.isAllowed(other_operation));
      assert.equal(_throttler._credits.get(other_operation), 2);
      assert.equal(LocalBackend.counterValue(metrics.throttlerUpdateSuccess), 1);
      done();
    };
    throttler._refreshCredits();
  });

  it('emit failure metric on failing to query for credits', done => {
    throttler.setProcess({ uuid: uuid });
    throttler._credits.set(operation, 0);
    metrics.throttlerUpdateFailure.increment = function() {
      assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
      done();
    };
    throttler._host = 'Llanfair­pwllgwyngyll­gogery­chwyrn­drobwll­llan­tysilio­gogo­goch';
    throttler._refreshCredits();
  });

  it('emit failure metric on failing to parse bad http response', done => {
    throttler.setProcess({ uuid: uuid });
    throttler._credits.set(operation, 0);
    metrics.throttlerUpdateFailure.increment = function() {
      assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
      done();
    };
    server.addCredits(serviceName, 'not-json');
    throttler._refreshCredits();
  });

  it('emit failure metric when server returns an invalid response', done => {
    throttler.setProcess({ uuid: uuid });
    throttler._credits.set(operation, 0);
    metrics.throttlerUpdateFailure.increment = function() {
      assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
      done();
    };
    throttler._refreshCredits();
  });

  it('not fetch credits if no operations have been seen', () => {
    throttler.setProcess({ uuid: uuid });
    throttler._refreshCredits();
    assert.equal(throttler._credits.size, 0);
  });

  it('refresh periodically', done => {
    logger.error = function(msg) {
      console.log('error called');
      assert.equal(msg, 'UUID must be set to fetch credits');
      done();
    };
    throttler = new RemoteThrottler(serviceName, {
      initialDelayMs: 1,
      metrics: metrics,
      logger: logger,
    });
  }).timeout(10000); // WTF?
});

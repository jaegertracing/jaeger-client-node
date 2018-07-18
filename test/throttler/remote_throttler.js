// Copyright (c) 2018 Uber Technologies, Inc.
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

import { assert } from 'chai';
import Metrics from '../../src/metrics/metrics.js';
import MockLogger from '../lib/mock_logger';
import ConfigServer from '../lib/config_server';
import LocalMetricFactory from '../lib/metrics/local/metric_factory.js';
import LocalBackend from '../lib/metrics/local/backend.js';
import RemoteThrottler from '../../src/throttler/remote_throttler';
import sinon from 'sinon';

describe('RemoteThrottler should', () => {
  let server: ConfigServer;
  let logger: MockLogger;
  let metrics: Metrics;
  let throttler: RemoteThrottler;
  let serviceName = 'service';
  let operation = 'op';
  let other_operation = 'oop';
  let uuid = 'uuid';
  let creditsUpdatedHook;

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
    creditsUpdatedHook = sinon.spy();
    throttler = new RemoteThrottler(serviceName, {
      refreshIntervalMs: 0,
      initialDelayMs: 60000,
      metrics: metrics,
      logger: logger,
      onCreditsUpdate: (...args) => creditsUpdatedHook(...args),
    });
  });

  afterEach(() => {
    throttler.close();
  });

  it('return false for isAllowed on initial call and return true once credits are initialized', done => {
    throttler.setProcess({ uuid: uuid });
    server.addCredits(serviceName, [{ operation: operation, balance: 3 }]);
    creditsUpdatedHook = _throttler => {
      assert.isOk(_throttler.isAllowed(operation));
      assert.equal(_throttler._credits[operation], 2);
      assert.equal(LocalBackend.counterValue(metrics.throttlerUpdateSuccess), 1);
      assert.equal(LocalBackend.counterValue(metrics.throttledDebugSpans), 1);
      done();
    };
    assert.isNotOk(throttler.isAllowed(operation));
    throttler._refreshCredits();
  });

  it('log an error if _refreshCredits is called prior to UUID being set', () => {
    throttler._fetchCredits = sinon.spy();
    throttler._refreshCredits();
    assert.equal(logger._errorMsgs.length, 1);
    sinon.assert.notCalled(throttler._fetchCredits);
  });

  it('not fetch credits if uuid is invalid', () => {
    throttler._fetchCredits = sinon.spy();
    throttler.setProcess({ uuid: null });
    throttler._refreshCredits();
    assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
    sinon.assert.notCalled(throttler._fetchCredits);
  });

  it("return false for _isAllowed if operation isn't in _credits or operation has no credits", () => {
    assert.isNotOk(
      throttler._isAllowed(operation),
      'operation is not set so operation should not be allowed'
    );
    throttler._credits[operation] = 0;
    assert.isNotOk(throttler._isAllowed(operation), 'operation is set but lacks credit');
    assert.equal(LocalBackend.counterValue(metrics.throttledDebugSpans), 2);
  });

  it("return false for isAllowed if operation doesn't have enough credits", () => {
    throttler._credits[operation] = 0.5;
    assert.isNotOk(throttler._isAllowed(operation));
    assert.equal(LocalBackend.counterValue(metrics.throttledDebugSpans), 1);
  });

  it('succeed when we retrieve credits for multiple operations', done => {
    throttler.setProcess({ uuid: uuid });
    server.addCredits(serviceName, [
      { operation: operation, balance: 5 },
      { operation: other_operation, balance: 3 },
    ]);
    throttler._credits[operation] = 0;
    throttler._credits[other_operation] = 0;
    creditsUpdatedHook = _throttler => {
      assert.isOk(_throttler.isAllowed(operation));
      assert.equal(_throttler._credits[operation], 4);
      assert.isOk(_throttler.isAllowed(other_operation));
      assert.equal(_throttler._credits[other_operation], 2);
      assert.equal(LocalBackend.counterValue(metrics.throttlerUpdateSuccess), 1);
      done();
    };
    throttler._refreshCredits();
  });

  it('emit failure metric on failing to query for credits', done => {
    throttler.setProcess({ uuid: uuid });
    throttler._credits[operation] = 0;
    metrics.throttlerUpdateFailure.increment = function() {
      assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
      done();
    };
    throttler._host = 'Llanfair­pwllgwyngyll­gogery­chwyrn­drobwll­llan­tysilio­gogo­goch';
    throttler._refreshCredits();
  });

  it('emit failure metric on failing to parse bad http json response', done => {
    throttler.setProcess({ uuid: uuid });
    throttler._credits[operation] = 0;
    metrics.throttlerUpdateFailure.increment = function() {
      assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
      done();
    };
    server.addCredits(serviceName, 'not-json');
    throttler._refreshCredits();
  });

  it('emit failure metric when server returns an invalid response', done => {
    throttler.setProcess({ uuid: uuid });
    throttler._credits[operation] = 0;
    metrics.throttlerUpdateFailure.increment = function() {
      assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
      done();
    };
    throttler._refreshCredits();
  });

  it('not fetch credits if no operations have been seen', () => {
    throttler = new RemoteThrottler(serviceName);
    throttler._fetchCredits = sinon.spy();
    throttler.setProcess({ uuid: uuid });
    throttler._refreshCredits();
    sinon.assert.notCalled(throttler._fetchCredits);
    throttler.close();
  });

  it('refresh credits after _afterInitialDelay is called', done => {
    throttler.setProcess({ uuid: uuid });
    throttler._credits[operation] = 0;
    server.addCredits(serviceName, [{ operation: operation, balance: 5 }]);
    creditsUpdatedHook = _throttler => {
      assert.isOk(_throttler.isAllowed(operation));
      assert.equal(_throttler._credits[operation], 4);
      assert.equal(LocalBackend.counterValue(metrics.throttlerUpdateSuccess), 1);
      done();
    };
    throttler._afterInitialDelay();
  });
});

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

import { assert } from 'chai';
import sinon from 'sinon';
import Metrics from '../../src/metrics/metrics.js';
import RateLimitingSampler from '../../src/samplers/rate_limiting_sampler';
import ProbabilisticSampler from '../../src/samplers/probabilistic_sampler.js';
import PerOperationSampler from '../../src/samplers/per_operation_sampler';
import RemoteSampler from '../../src/samplers/remote_sampler';
import MockLogger from '../lib/mock_logger';
import ConfigServer from '../lib/config_server';
import LocalMetricFactory from '../lib/metrics/local/metric_factory.js';
import LocalBackend from '../lib/metrics/local/backend.js';
import Tracer from '../../src/tracer.js';
import NoopReporter from '../../src/reporters/noop_reporter.js';

describe('RemoteSampler', () => {
  let server: ConfigServer;
  let logger: MockLogger;
  let metrics: Metrics;
  let remoteSampler: RemoteSampler;

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
    remoteSampler = new RemoteSampler('service1', {
      refreshInterval: 0,
      metrics: metrics,
      logger: logger,
    });
  });

  afterEach(() => {
    remoteSampler.close();
  });

  it('should log metric on failing to query for sampling strategy', done => {
    metrics.samplerQueryFailure.increment = function() {
      assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
      done();
    };
    remoteSampler._port = 1; // Nothing running on this port, should error
    remoteSampler._refreshSamplingStrategy();
  });

  let badResponses: Array<any> = ['junk', '0', 'false', {}];
  badResponses.forEach(resp => {
    it(`should log metric on failing to parse bad http response ${resp}`, done => {
      metrics.samplerUpdateFailure.increment = function() {
        assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
        done();
      };
      server.addStrategy('service1', resp);
      remoteSampler._refreshSamplingStrategy();
    });
  });

  it('should throw error on bad sampling strategy', done => {
    metrics.samplerUpdateFailure.increment = function() {
      assert.equal(logger._errorMsgs.length, 1);
      done();
    };
    remoteSampler._serviceName = 'bad-service';
    remoteSampler._refreshSamplingStrategy();
  });

  it('should set probabilistic sampler, but only once', done => {
    remoteSampler._onSamplerUpdate = s => {
      assert.equal(s._samplingRate, 1.0);
      assert.equal(LocalBackend.counterValue(metrics.samplerRetrieved), 1);
      assert.equal(LocalBackend.counterValue(metrics.samplerUpdated), 1);

      let firstSampler = s;

      // prepare for second update
      remoteSampler._onSamplerUpdate = s => {
        assert.strictEqual(s, firstSampler, 'must not have changed the sampler');

        assert.equal(LocalBackend.counterValue(metrics.samplerRetrieved), 2);
        assert.equal(LocalBackend.counterValue(metrics.samplerUpdated), 1);

        // prepare for third update - for test coverage only
        remoteSampler._onSamplerUpdate = null;
        remoteSampler._refreshSamplingStrategy();

        done();
      };

      remoteSampler._refreshSamplingStrategy();
    };
    server.addStrategy('service1', {
      strategyType: 'PROBABILISTIC',
      probabilisticSampling: {
        samplingRate: 1.0,
      },
    });
    remoteSampler._refreshSamplingStrategy();
  });

  it('should set ratelimiting sampler', done => {
    let maxTracesPerSecond = 10;
    remoteSampler._onSamplerUpdate = s => {
      assert.isTrue(s.equal(new RateLimitingSampler(maxTracesPerSecond)));
      done();
    };
    server.addStrategy('service1', {
      strategyType: 'RATE_LIMITING',
      rateLimitingSampling: {
        maxTracesPerSecond: maxTracesPerSecond,
      },
    });
    remoteSampler._refreshSamplingStrategy();
  });

  it('should update ratelimiting sampler', done => {
    let rateLimitingSampler = new RateLimitingSampler(10);
    remoteSampler._sampler = rateLimitingSampler;
    let maxTracesPerSecond = 5;
    remoteSampler._onSamplerUpdate = s => {
      assert.strictEqual(rateLimitingSampler, remoteSampler._sampler);
      assert.isTrue(s.equal(new RateLimitingSampler(maxTracesPerSecond)));
      done();
    };
    server.addStrategy('service1', {
      strategyType: 'RATE_LIMITING',
      rateLimitingSampling: {
        maxTracesPerSecond: maxTracesPerSecond,
      },
    });
    remoteSampler._refreshSamplingStrategy();
  });

  it('should reset probabilistic sampler', done => {
    remoteSampler._sampler = new RateLimitingSampler(10);
    assert.instanceOf(remoteSampler._sampler, RateLimitingSampler);
    remoteSampler._onSamplerUpdate = s => {
      assert.instanceOf(remoteSampler._sampler, ProbabilisticSampler);
      done();
    };
    server.addStrategy('service1', {
      strategyType: 'PROBABILISTIC',
      probabilisticSampling: {
        samplingRate: 1.0,
      },
    });
    remoteSampler._refreshSamplingStrategy();
  });

  it('should set per-operation sampler', done => {
    server.addStrategy('service1', {
      strategyType: 'PROBABILISTIC',
      probabilisticSampling: {
        samplingRate: 1.0,
      },
      operationSampling: {
        defaultSamplingProbability: 0.05,
        defaultLowerBoundTracesPerSecond: 0.1,
        perOperationStrategies: [],
      },
    });
    remoteSampler._onSamplerUpdate = s => {
      assert.isTrue(s instanceof PerOperationSampler);
      assert.equal(LocalBackend.counterValue(metrics.samplerRetrieved), 1);
      assert.equal(LocalBackend.counterValue(metrics.samplerUpdated), 1);

      // cause a second refresh without changes
      remoteSampler._onSamplerUpdate = s2 => {
        assert.strictEqual(s2, s);
        assert.equal(LocalBackend.counterValue(metrics.samplerRetrieved), 2, 'second retrieval');
        assert.equal(LocalBackend.counterValue(metrics.samplerUpdated), 1, 'but no update');
        done();
      };
      remoteSampler._refreshSamplingStrategy();
    };
    remoteSampler._refreshSamplingStrategy();
  });

  it('should not use per-operation sampler on child spans', done => {
    server.addStrategy('service1', {
      strategyType: 'PROBABILISTIC',
      probabilisticSampling: {
        samplingRate: 0.0,
      },
      operationSampling: {
        defaultSamplingProbability: 0.05,
        defaultLowerBoundTracesPerSecond: 0.1,
        perOperationStrategies: [
          {
            operation: 'op1',
            probabilisticSampling: { samplingRate: 0.0 },
          },
          {
            operation: 'op2',
            probabilisticSampling: { samplingRate: 1.0 },
          },
        ],
      },
    });
    remoteSampler._onSamplerUpdate = s => {
      let tracer = new Tracer('service', new NoopReporter(), s);

      let sp0 = tracer.startSpan('op2');
      assert.isTrue(sp0.context().isSampled(), 'op2 should be sampled on the root span');

      let sp1 = tracer.startSpan('op1');
      assert.isFalse(sp1.context().isSampled(), 'op1 should not be sampled');
      sp1.setOperationName('op2');
      assert.isTrue(sp1.context().isSampled(), 'op2 should be sampled on the root span');

      let parent = tracer.startSpan('op1', 'op1 should not be sampled');
      assert.isFalse(parent.context().isSampled());
      assert.isFalse(parent.context().samplingFinalized);

      let child = tracer.startSpan('op2', { childOf: parent });
      assert.isFalse(child.context().isSampled(), 'op2 should not be sampled on the child span');
      child.setOperationName('op2');
      assert.isFalse(child.context().isSampled(), 'op2 should not be sampled on the child span');

      done();
    };
    remoteSampler._refreshSamplingStrategy();
  });

  it('should refresh periodically', done => {
    server.addStrategy('service1', {
      strategyType: 'PROBABILISTIC',
      probabilisticSampling: {
        samplingRate: 0.777,
      },
    });

    let clock: any = sinon.useFakeTimers();

    let sampler = new RemoteSampler('service1', {
      refreshInterval: 10, // 10ms
      metrics: metrics,
      logger: logger,
      onSamplerUpdate: s => {
        assert.notEqual(LocalBackend.counterValue(metrics.samplerRetrieved), 0);
        assert.notEqual(LocalBackend.counterValue(metrics.samplerUpdated), 0);
        assert.equal(logger._errorMsgs.length, 0, 'number of error logs');
        assert.isTrue(sampler._sampler.equal(new ProbabilisticSampler(0.777)), sampler._sampler.toString());

        clock.restore();

        sampler._onSamplerUpdate = null;
        sampler.close(done);
      },
    });

    clock.tick(20);
  });

  it('should delegate all sampling calls', () => {
    const decision: SamplingDecision = {
      sample: false,
      retryable: true,
      tags: null,
      fake: 'fake',
    };
    const mockSampler: Sampler = {
      onCreateSpan: function onCreateSpan(span: Span): SamplingDecision {
        this._onCreateSpan = [span];
        return decision;
      },
      onSetOperationName: function onSetOperationName(span: Span, operationName: string): SamplingDecision {
        this._onSetOperationName = [span, operationName];
        return decision;
      },
      onSetTag: function onSetOperationName(span: Span, key: string, value: any): SamplingDecision {
        this._onSetTag = [span, key, value];
        return decision;
      },
    };
    remoteSampler._sampler = mockSampler;
    const span: Span = { fake: 'fake' };

    assert.deepEqual(decision, remoteSampler.onCreateSpan(span));
    assert.deepEqual([span], mockSampler._onCreateSpan);

    assert.deepEqual(decision, remoteSampler.onSetOperationName(span, 'op1'));
    assert.deepEqual([span, 'op1'], mockSampler._onSetOperationName);

    assert.deepEqual(decision, remoteSampler.onSetTag(span, 'pi', 3.1415));
    assert.deepEqual([span, 'pi', 3.1415], mockSampler._onSetTag);
  });

  it('should support setting a custom path for sampling endpoint', () => {
    let samplingPath = '/custom-sampling-path';
    let rs = new RemoteSampler('service1', {
      samplingPath: samplingPath,
    });
    assert.equal(rs._samplingPath, samplingPath);
  });
});

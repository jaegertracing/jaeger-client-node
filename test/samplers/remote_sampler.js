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

import {assert} from 'chai';
import sinon from 'sinon';
import Metrics from '../../src/metrics/metrics.js';
import RateLimitingSampler from '../../src/samplers/ratelimiting_sampler';
import ProbabilisticSampler from '../../src/samplers/probabilistic_sampler.js';
import PerOperationSampler from '../../src/samplers/per_operation_sampler';
import RemoteSampler from '../../src/samplers/remote_sampler';
import MockLogger from '../lib/mock_logger';
import SamplingServer from '../lib/sampler_server';
import LocalMetricFactory from '../lib/metrics/local/metric_factory.js';
import LocalBackend from '../lib/metrics/local/backend.js';

describe('RemoteSampler', () => {
    let server: SamplingServer;
    let logger: MockLogger;
    let metrics: Metrics;
    let remoteSampler: RemoteSampler;

    before(() => {
        server = new SamplingServer().start();
    });

    after(() => {
        server.close();
    });

    beforeEach(() => {
        server.clearStrategies();
        logger = new MockLogger();
        metrics = new Metrics(new LocalMetricFactory());
        remoteSampler = new RemoteSampler('service1', {
            refreshInterval: 0,
            metrics: metrics,
            logger: logger
        });
    });

    afterEach(() => {
        remoteSampler.close();
    });

    it ('should log metric on failing to query for sampling strategy', (done) => {
        metrics.samplerQueryFailure.increment = function() {
            assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
            done();
        };
        remoteSampler._host = 'fake-host';
        remoteSampler._refreshSamplingStrategy();
    });

    let badResponses: Array<any> = ['junk', '0', 'false', {}];
    badResponses.forEach((resp) => {
        it (`should log metric on failing to parse bad http response ${resp}`, (done) => {
            metrics.samplerParsingFailure.increment = function() {
                assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
                done();
            };
            server.addStrategy('service1', resp);
            remoteSampler._refreshSamplingStrategy();
        });
    });

    it('should throw error on bad sampling strategy', (done) => {
        metrics.samplerParsingFailure.increment = function() {
            assert.equal(logger._errorMsgs.length, 1);
            done();
        };
        remoteSampler._serviceName = 'bad-service';
        remoteSampler._refreshSamplingStrategy();
    });

    it('should set probabilistic sampler, but only once', (done) => {
        remoteSampler._onSamplerUpdate = (s) => {
            assert.equal(s._samplingRate, 1.0);
            assert.equal(LocalBackend.counterValue(metrics.samplerRetrieved), 1);
            assert.equal(LocalBackend.counterValue(metrics.samplerUpdated), 1);

            let firstSampler = s;

            // prepare for second update
            remoteSampler._onSamplerUpdate = (s) => {
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
                samplingRate: 1.0
            }
        });
        remoteSampler._refreshSamplingStrategy();
    });

    it('should set ratelimiting sampler', (done) => {
        let maxTracesPerSecond = 10;
        remoteSampler._onSamplerUpdate = (s) => {
            assert.isOk(s.equal(new RateLimitingSampler(maxTracesPerSecond)));
            done();
        };
        server.addStrategy('service1', {
            strategyType: 'RATE_LIMITING',
            rateLimitingSampling: {
                maxTracesPerSecond: maxTracesPerSecond
            }
        });
        remoteSampler._refreshSamplingStrategy();
    });

    it('should update ratelimiting sampler', (done) => {
        let rateLimitingSampler = new RateLimitingSampler(10);
        remoteSampler._sampler = rateLimitingSampler;
        let maxTracesPerSecond = 5;
        remoteSampler._onSamplerUpdate = (s) => {
            assert.strictEqual(rateLimitingSampler, remoteSampler._sampler);
            assert.isOk(s.equal(new RateLimitingSampler(maxTracesPerSecond)));
            done();
        };
        server.addStrategy('service1', {
            strategyType: 'RATE_LIMITING',
            rateLimitingSampling: {
                maxTracesPerSecond: maxTracesPerSecond
            }
        });
        remoteSampler._refreshSamplingStrategy();
    });

    it('should set per-operation sampler', (done) => {
        server.addStrategy('service1', {
            strategyType: 'PROBABILISTIC',
            probabilisticSampling: {
                samplingRate: 1.0
            },
            operationSampling: {
                defaultSamplingProbability: 0.05,
                defaultLowerBoundTracesPerSecond: 0.1,
                perOperationStrategies: []
            }
        });
        remoteSampler._onSamplerUpdate = (s) => {
            assert.isOk(s instanceof PerOperationSampler);
            assert.equal(LocalBackend.counterValue(metrics.samplerRetrieved), 1);
            assert.equal(LocalBackend.counterValue(metrics.samplerUpdated), 1);

            // cause a second refresh without changes
            remoteSampler._onSamplerUpdate = (s2) => {
                assert.strictEqual(s2, s);
                assert.equal(LocalBackend.counterValue(metrics.samplerRetrieved), 2, 'second retrieval');
                assert.equal(LocalBackend.counterValue(metrics.samplerUpdated), 1, 'but no update');
                done();
            };
            remoteSampler._refreshSamplingStrategy();
        };
        remoteSampler._refreshSamplingStrategy();
    });

    it('should refresh periodically', (done) => {
        server.addStrategy('service1', {
            strategyType: 'PROBABILISTIC',
            probabilisticSampling: {
                samplingRate: 0.777
            }
        });

        let clock: any = sinon.useFakeTimers();

        let sampler = new RemoteSampler('service1', {
            refreshInterval: 10, // 10ms
            metrics: metrics,
            logger: logger,
            onSamplerUpdate: (s) => {
                assert.notEqual(LocalBackend.counterValue(metrics.samplerRetrieved), 0);
                assert.notEqual(LocalBackend.counterValue(metrics.samplerUpdated), 0);
                assert.equal(logger._errorMsgs.length, 0, 'number of error logs');
                assert.isTrue(sampler._sampler.equal(new ProbabilisticSampler(0.777)), sampler._sampler.toString());

                clock.restore();

                sampler._onSamplerUpdate = null;
                sampler.close(done);
            }
        });

        clock.tick(20);
    });
});

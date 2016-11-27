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

import {assert} from 'chai';
import sinon from 'sinon';
import Metrics from '../../src/metrics/metrics.js';
import RateLimitingSampler from '../../src/samplers/ratelimiting_sampler';
import RemoteSampler from '../../src/samplers/remote_sampler';
import MockLogger from '../lib/mock_logger';
import SamplingServer from '../lib/sampler_server';
import LocalMetricFactory from '../lib/metrics/local/metric_factory.js';
import LocalBackend from '../lib/metrics/local/backend.js';

describe('remote sampler should', () => {
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

    it('set probabilistic sampler', (done) => {
        remoteSampler._onSamplerUpdate = (s) => {
            assert.equal(s._samplingRate, 1.0);
            assert.isOk(LocalBackend.counterEquals(metrics.samplerRetrieved, 1));
            assert.isOk(LocalBackend.counterEquals(metrics.samplerUpdated, 1));
            done();
        }
        server.addStrategy('service1', {
            strategyType: 0,
            probabilisticSampling: {
                samplingRate: 1.0
            }
        });
        remoteSampler._refreshSamplingStrategy();
    });

    it ('log metric on failing sampling strategy', (done) => {
        metrics.samplerQueryFailure.increment = function() {
            assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
            done();
        };
        remoteSampler._host = 'fake-host';
        remoteSampler._refreshSamplingStrategy();
    });

    it('set ratelimiting sampler', (done) => {
        let maxTracesPerSecond = 10;
        remoteSampler._onSamplerUpdate = (s) => {
            assert.isOk(s.equal(new RateLimitingSampler(maxTracesPerSecond)));
            done();
        };
        server.addStrategy('service1', {
            strategyType: 1,
            rateLimitingSampling: {
                maxTracesPerSecond: maxTracesPerSecond
            }
        });
        remoteSampler._refreshSamplingStrategy();
    });

    it('throw error on bad sampling strategy', (done) => {
        metrics.samplerParsingFailure.increment = function() {
            assert.equal(logger._errorMsgs.length, 1);
            done();
        };
        remoteSampler._serviceName = 'bad-service';
        remoteSampler._refreshSamplingStrategy();
    });
});

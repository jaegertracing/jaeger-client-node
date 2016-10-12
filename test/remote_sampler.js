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
import MockLogger from './lib/mock_logger';
import RemoteSampler from '../src/samplers/remote_sampler';
import SamplingServer from './lib/sampler_server';
import MetricsContainer from '../src/metrics/metrics.js';
import LocalMetricFactory from '../src/metrics/local/metric_factory.js';
import LocalBackend from '../src/metrics/local/backend.js';

describe('remote sampler should', () => {
    let server: SamplingServer;
    before(() => {
        server = new SamplingServer().start();
    });

    after(() => {
        server.close();
    });

    it('set probabilistic sampler', (done) => {
        let metrics = new MetricsContainer(new LocalMetricFactory());
        let sampler = new RemoteSampler('probabilistic-service', {
            stopPolling: true,
            metrics: metrics,
            onSamplerUpdate: (sampler) => {
                assert.equal(sampler._samplingRate, 1.0);

                // metrics
                assert.isOk(LocalBackend.counterEquals(metrics.samplerRetrieved, 1));
                assert.isOk(LocalBackend.counterEquals(metrics.samplerUpdated, 1));

                sampler.close();
                done();
            }
        });
        sampler._refreshSamplingStrategy();
    });

    it ('log metric on failing sampling strategy', (done) => {
        let logger = new MockLogger();
        let metrics = new MetricsContainer(new LocalMetricFactory());
        let sampler = new RemoteSampler('error-service', {
            stopPolling: true,
            metrics: metrics,
            logger: logger,
            onSamplerUpdate: () => {
                assert.equal(logger._errorMsgs[0], 'Error in fetching sampling strategy.');

                //metrics
                assert.isOk(LocalBackend.counterEquals(metrics.samplerQueryFailure, 1));
                done();
            }
        });

        sampler._host = 'fake-host';
        sampler._refreshSamplingStrategy();
    });

    it('set ratelimiting sampler', (done) => {
        let sampler = new RemoteSampler('ratelimiting-service', {
            stopPolling: true,
            onSamplerUpdate: (sampler) => {
                assert.equal(sampler._maxTracesPerSecond, 10);
                sampler.close();
                done();
            }
        });
        sampler._refreshSamplingStrategy();
    });

    it('throw error on bad sampling strategy', (done) => {
        let logger = new MockLogger();
        let metrics = new MetricsContainer(new LocalMetricFactory());
        let sampler = new RemoteSampler('error-service', {
            stopPolling: true,
            metrics: metrics,
            logger: logger,
            onSamplerUpdate: () => {
                assert.equal(logger._errorMsgs[0], 'Unrecognized strategy type: {"error":{"err":"bad things happened"}}');

                //metrics
                assert.isOk(LocalBackend.counterEquals(metrics.samplerParsingFailure, 1));

                done();
            }
        });
        sampler._refreshSamplingStrategy();
    });
});

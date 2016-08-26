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
import MockLogger from './lib/mock_logger.js';
import RemoteSampler from '../src/samplers/remote_sampler.js';
import SamplingServer from './lib/sampler_server.js';

describe('remote sampler should', () => {
    let server: SamplingServer;
    before(() => {
        server = new SamplingServer().start();
    });

    after(() => {
        server.close();
    });

    it('set probabilistic sampler', (done) => {
        let sampler = new RemoteSampler('probabilistic-service', {
            firstRefreshDelay: false,
            onSamplerUpdate: (sampler) => {
                assert.equal(sampler._samplingRate, 1.0);
                sampler.close();
                done();
            }
        });
    });

    it('set ratelimiting sampler', (done) => {
        let sampler = new RemoteSampler('ratelimiting-service', {
            firstRefreshDelay: false,
            onSamplerUpdate: (sampler) => {
                assert.equal(sampler._maxTracesPerSecond, 10);
                sampler.close();
                done();
            }
        });
    });

    it('throw error on bad sampling strategy', (done) => {
        let logger = new MockLogger();
        let sampler = new RemoteSampler('error-service', {
            firstRefreshDelay: false,
            logger: logger,
            onSamplerUpdate: () => {
                assert.equal(logger._errorMsgs[0], 'Unrecognized strategy type: {"error":{"err":"bad things happened"}}');
                done();
            }
        });
    });
});

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

import _ from 'lodash';
import {assert, expect} from 'chai';
import NoopReporter from '../src/reporters/noop_reporter';
import CompositeReporter from '../src/reporters/composite_reporter';
import RemoteReporter from '../src/reporters/remote_reporter';
import ConstSampler from '../src/samplers/const_sampler';
import ProbabilisticSampler from '../src/samplers/probabilistic_sampler';
import RemoteSampler from '../src/samplers/remote_sampler';
import RateLimitingSampler from '../src/samplers/ratelimiting_sampler';
import {initTracer} from '../src/index.js';
import opentracing from 'opentracing';

describe('initTracer', () => {
    it ('should initialize noop tracer when disable is set', () => {
        let config = {
            serviceName: 'test-service',
            disable: true
        };
        let tracer = initTracer(config);

        expect(tracer).to.be.an.instanceof(opentracing.Tracer);
    });

    it ('should initialize normal tracer when only service name given', () => {
        let config = {
            serviceName: 'test-service'
        };
        let tracer = initTracer(config);

        expect(tracer._sampler).to.be.an.instanceof(RemoteSampler);
        expect(tracer._reporter).to.be.an.instanceof(RemoteReporter);
    });

    it ('should initialize proper samplers', () => {
        var config = {
            serviceName: 'test-service'
        };
        var options = [
            { type: 'const', param: 1, expectedType: ConstSampler, expectedParam: 1 },
            { type: 'ratelimiting', param: 2, expectedType: RateLimitingSampler, expectedParam: 2 },
            { type: 'probabilistic', param: 0.5, expectedType: ProbabilisticSampler, expectedParam: 0.5 },
            { type: 'remote', param: 1, expectedType: RemoteSampler, expectedParam: 1 }
        ];

        _.each(options, (samplerConfig) => {
            let expectedType = samplerConfig.expectedType;
            let expectedParam = samplerConfig.expectedParam;
            delete samplerConfig.expectedType;
            delete samplerConfig.expectedParam;

            config.sampler = samplerConfig;
            let tracer = initTracer(config);

            expect(tracer._sampler).to.be.an.instanceof(expectedType);
            // TODO(oibe:head) test utils for expectedParam here?
        });
    });

    it ('should throw error on sampler incorrect type', () => {
        var config = {
            serviceName: 'test-service'
        };
        var options = [
            { type: 'const', param: 'bad-value' },
            { type: 'ratelimiting', param: 'bad-value' },
            { type: 'probabilistic', param: 'bad-value' },
            { type: 'remote', param: 'bad-value' },
        ];

        let count = 0;
        _.each(options, (samplerConfig) => {
            config.sampler = samplerConfig;

            // Since its an error from a third party framework, its hard to assert on
            // using expect.
            try {
                initTracer(config);
            } catch(err) {
                count +=1;
            }
        });

        assert.equal(count, 4);
    });

    it ('should respect reporter options', () => {
        let config = {
            serviceName: 'test-service',
            sampler: {
                type: 'const',
                param: 0
            },
            reporter: {
                logSpans: true,
                agentHost: '127.0.0.1',
                agentPort: 4939,
                flushIntervalMs: 2000
            }
        }
        let tracer = initTracer(config);

        expect(tracer._reporter).to.be.an.instanceof(CompositeReporter);
        let remoteReporter;
        for (let i = 0; i < tracer._reporter._reporters.length; i++) {
            let reporter = tracer._reporter._reporters[i];
            if (reporter instanceof RemoteReporter) {
                remoteReporter = reporter;
                break;
            }
        }

        assert.equal(remoteReporter._bufferFlushInterval, 2000);
        assert.equal(remoteReporter._sender._host, '127.0.0.1');
        assert.equal(remoteReporter._sender._port, 4939);
    });

    it ('should pass options to tracer', () => {
        var logger = {
            'info': function info(msg){}
        };
        var metrics = {
            'createCounter': function createCounter() { return {}; },
            'createGauge': function createGauge() { return {}; },
            'createTimer': function createTimer() { return {}; },
        };
        let tracer = initTracer({
            serviceName: 'test-service'
        }, {
            logger: logger,
            metrics: metrics,
            tags: {
                'x': 'y'
            }
        });
        assert.equal(tracer._logger, logger);
        assert.equal(tracer._metrics._factory, metrics);
        assert.equal(tracer._tags['x'], 'y');
    });
});

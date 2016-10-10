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
import fs from 'fs';
import path from 'path';
import NoopReporter from '../src/reporters/noop_reporter';
import RemoteReporter from '../src/reporters/remote_reporter';
import ConstSampler from '../src/samplers/const_sampler';
import ProbabilisticSampler from '../src/samplers/probabilistic_sampler';
import RemoteSampler from '../src/samplers/remote_sampler';
import RatelimitingSampler from '../src/samplers/ratelimiting_sampler';
import yaml from 'js-yaml';
import {initTracer} from '../src/index.js';

describe('initTracer', () => {
    it ('should initialize noop when disable is set', () => {
        let configFile = fs.readFileSync(path.join(__dirname, 'config' , 'disable_tracer.yaml'), 'utf8');
        let config = yaml.safeLoad(configFile);
        let tracer = initTracer(config);

        expect(tracer._sampler).to.be.an.instanceof(ConstSampler);
        expect(tracer._reporter).to.be.an.instanceof(NoopReporter);
    });

    it ('should initialize normal tracer when only service name given', () => {
        let configFile = fs.readFileSync(path.join(__dirname, 'config' , 'basic_tracer.yaml'), 'utf8');
        let config = yaml.load(configFile);
        let tracer = initTracer(config);

        expect(tracer._sampler).to.be.an.instanceof(RemoteSampler);
        expect(tracer._reporter).to.be.an.instanceof(RemoteReporter);
    });

    it ('should initialize proper samplers', () => {
        var config = {
            jaeger: {
                serviceName: 'test-service'
            }
        };
        var options = [
            { type: 'const', param: true, expected: ConstSampler },
            { type: 'ratelimiting', param: true, expected: RatelimitingSampler },
            { type: 'probabilistic', param: true, expected: ProbabilisticSampler },
            { type: 'remote', param: true, expected: RemoteSampler },
        ];

        _.each(options, (samplerConfig) => {
            let expected = samplerConfig.expected;
            delete samplerConfig.expected;
            config.jaeger.sampler = samplerConfig;
            let tracer = initTracer(config);
            expect(tracer._sampler).to.be.an.instanceof(expected);
        });
    });

    it ('should throw error on sampler incorrect type', () => {
        var config = {
            jaeger: {
                serviceName: 'test-service'
            }
        };
        var options = [
            { type: 'const', param: 'bad-value' },
            { type: 'ratelimiting', param: 'bad-value' },
            { type: 'probabilistic', param: 'bad-value' },
            { type: 'remote', param: 0xbad },
        ];

        let count = 0;
        _.each(options, (samplerConfig) => {
            config.jaeger.sampler = samplerConfig;

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
        let configFile = fs.readFileSync(path.join(__dirname, 'config' , 'tracer_with_reporter_options.yaml'), 'utf8');
        let config = yaml.load(configFile);
        let tracer = initTracer(config);

        // TODO(oibe) replace with TestUtils
        assert.equal(tracer._reporter._bufferFlushInterval, 2000);
        assert.equal(tracer._reporter._sender._hostPort, '127.0.0.1:4939');
    });
});

// @flow
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

import {assert, expect} from 'chai';
import sinon from 'sinon';
import * as constants from '../../src/constants.js';
import ConstSampler from '../../src/samplers/const_sampler.js';
import ProbabilisticSampler from '../../src/samplers/probabilistic_sampler.js';
import RateLimitingSampler from '../../src/samplers/ratelimiting_sampler.js';
import GuaranteedThroughputSampler from '../../src/samplers/guaranteed_throughput_sampler.js';
import PerOperationSampler from '../../src/samplers/per_operation_sampler.js';
import RemoteSampler from '../../src/samplers/remote_sampler.js';
import combinations from '../lib/combinations.js'

describe('All samplers', () => {
    describe('should support close()', () => {
        let samplers = combinations({
            useCallback: [true, false],
            sampler: [
                new ConstSampler(true),
                new ConstSampler(false),
                new ProbabilisticSampler(0.5),
                new RateLimitingSampler(2),
                new GuaranteedThroughputSampler(2, 0.5),
                new PerOperationSampler({
                    defaultLowerBoundTracesPerSecond: 2,
                    defaultSamplingProbability: 0.01,
                    perOperationStrategies: [],
                }, 200),
                new RemoteSampler('some-service-name')
            ]
        });

        samplers.forEach((o: any) => {
            it (o.description, () => {
                if (o.useCallback) {
                    let closeCallback = sinon.spy();
                    o.sampler.close(closeCallback);
                    assert(closeCallback.calledOnce);
                } else {
                    o.sampler.close();
                }
            });
        });
    });

    describe('should return correct tags', () => {
        var samplers = [
            {sampler: new ConstSampler(true), 'type': constants.SAMPLER_TYPE_CONST, param: true, decision: true},
            {sampler: new ConstSampler(false), 'type': constants.SAMPLER_TYPE_CONST, param: false, decision: false},
            {sampler: new ProbabilisticSampler(1.0), 'type': constants.SAMPLER_TYPE_PROBABILISTIC, param: 1.0, decision: true},
            {sampler: new RateLimitingSampler(2), 'type': constants.SAMPLER_TYPE_RATE_LIMITING, param: 2, decision: true},
            {
                sampler: new RemoteSampler('some-caller-name', {sampler: new ProbabilisticSampler(1.0)}),
                'type': constants.SAMPLER_TYPE_PROBABILISTIC,
                param: 1.0,
                decision: true
            },
        ];

        samplers.forEach((samplerSetup: any) => {
            let sampler = samplerSetup['sampler'];
            it(sampler.toString(), () => {
                let expectedTags = {};
                let expectedDecision = !!samplerSetup['decision'];
                let description = `${sampler.toString()}, param=${samplerSetup['param']}`;

                if (expectedDecision) {
                    expectedTags[constants.SAMPLER_TYPE_TAG_KEY] = samplerSetup['type'];
                    expectedTags[constants.SAMPLER_PARAM_TAG_KEY] = samplerSetup['param'];
                }
                let actualTags = {};
                let decision = sampler.isSampled('operation', actualTags);
                assert.equal(decision, expectedDecision, description);
                assert.deepEqual(actualTags, expectedTags, description);
            });
        });
    });

});

describe('ConstSampler', () => {
    let sampler;
    before(() => {
        sampler = new ConstSampler(true);
    });

    it('decision reflects given parameter', () => {
        assert.isOk(sampler.decision);
    });

    it ('does NOT equal another type of sampler', () => {
        let otherSampler = new ProbabilisticSampler(0.5);
        let equals = sampler.equal(otherSampler);
        assert.isNotOk(equals);
    });

    it ('does equal the same type of sampler', () => {
        let otherSampler = new ConstSampler(true);
        let equals = sampler.equal(otherSampler);
        assert.isOk(equals);
    });
});

describe('ProbabilisticSampler', () => {
    it ('throws error on out of range sampling rate', () => {
        expect(() => { new ProbabilisticSampler(2.0); }).to.throw('The sampling rate must be less than 0.0 and greater than 1.0. Received 2');
    });

    it ('calls is Sampled, and returns false', () => {
        let sampler = new ProbabilisticSampler(0.0);
        let tags = {};
        assert.isNotOk(sampler.isSampled('operation', tags));
        assert.deepEqual(tags, {});
    });
});

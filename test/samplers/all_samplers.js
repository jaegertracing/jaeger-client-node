// @flow
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
            {sampler: new RateLimitingSampler(0.0001, 0), 'type': constants.SAMPLER_TYPE_RATE_LIMITING, param: 0.0001, decision: false},
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
        assert.isNotOk(sampler.equal(otherSampler));
    });

    it ('does equal the same type of sampler', () => {
        let otherSampler = new ConstSampler(true);
        assert.isOk(sampler.equal(otherSampler));
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

    it ('does NOT equal another type of sampler', () => {
        let sampler = new ProbabilisticSampler(0.0);
        let otherSampler = new ConstSampler(true);
        assert.isNotOk(sampler.equal(otherSampler));
    });
});

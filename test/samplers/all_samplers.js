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
import sinon from 'sinon';
import * as constants from '../../src/constants.js';
import ConstSampler from '../../src/samplers/const_sampler.js';
import ProbabilisticSampler from '../../src/samplers/probabilistic_sampler.js';
import RateLimitingSampler from '../../src/samplers/ratelimiting_sampler.js';
import RemoteSampler from '../../src/samplers/remote_sampler.js';
import Utils from '../../src/util';

describe('samplers should', () => {

    describe('All Samplers', () => {
        let samplers = Utils.combinations({
            useCallback: [true, false],
            sampler: [
                new ConstSampler(true),
                new ConstSampler(false),
                new ProbabilisticSampler(0.5),
                new RateLimitingSampler(2),
                new RemoteSampler('some-service-name')
            ]
        });

        _.each(samplers, (o) => {
            it ('should support close() - ' + o.description, () => {
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

    it('return correct tags', () => {
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

        _.each(samplers, (samplerSetup) => {
            let sampler = samplerSetup['sampler'];
            let expectedTags = {};
            let expectedDecision = !!samplerSetup['decision'];
            let description = `sampler ${sampler.name()}:${samplerSetup['param']} expectation`;

            if (expectedDecision) {
                expectedTags[constants.SAMPLER_TYPE_TAG_KEY] = samplerSetup['type'];
                expectedTags[constants.SAMPLER_PARAM_TAG_KEY] = samplerSetup['param'];
            }
            let actualTags = {};
            let decision = !!sampler.isSampled('operation', actualTags);
            assert.equal(decision, expectedDecision, description);
            assert.deepEqual(actualTags, expectedTags, description);
        });
    });
});

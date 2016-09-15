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

import _  from 'lodash';
import {assert} from 'chai';
import * as constants from '../src/constants.js';
import ConstSampler from '../src/samplers/const_sampler.js';
import ProbabilisticSampler from '../src/samplers/probabilistic_sampler.js';
import RateLimitingSampler from '../src/samplers/ratelimiting_sampler.js';
import RemoteSampler from '../src/samplers/remote_sampler.js';

describe('samplers should', () => {
    it('return correct tags', () => {
        var samplers = [
            {'sampler': new ConstSampler(true), 'type': constants.SAMPLER_TYPE_CONST, 'param': true},
            {'sampler': new ConstSampler(false), 'type': constants.SAMPLER_TYPE_CONST, 'param': false},
            {'sampler': new ProbabilisticSampler(0.1), 'type': constants.SAMPLER_TYPE_PROBABILISTIC, 'param': 0.1},
            {'sampler': new RateLimitingSampler(2), 'type': constants.SAMPLER_TYPE_RATE_LIMITING, 'param': 2},
            {'sampler': new RemoteSampler('some-caller-name'), 'type': constants.SAMPLER_TYPE_PROBABILISTIC, 'param': 0.001},
        ];

        _.each(samplers, (samplerSetup) => {
            let sampler = samplerSetup['sampler'];
            let expectedTags = {};
            expectedTags[constants.SAMPLER_TYPE_TAG_KEY] = samplerSetup['type'];
            expectedTags[constants.SAMPLER_PARAM_TAG_KEY] = samplerSetup['param'];
            let actualTags = sampler.getTags();

            assert.isOk(_.isEqual(expectedTags, actualTags));
        });
    });
});

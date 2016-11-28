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

import {assert} from 'chai';
import sinon from 'sinon';
import PerOperationSampler from '../../src/samplers/per_operation_sampler';

describe('PerOperationSampler', () => {

    let strategies: PerOperationSamplingStrategies = {
        defaultLowerBoundTracesPerSecond: 1.1,
        defaultSamplingProbability: 0.123,
        perOperationStrategies: [
            {
                operation: 'op1',
                probabilisticSampling: { samplingRate: 0.5 }
            }
        ]
    };

    it('should have a name and be closable', () => {
        let sampler = new PerOperationSampler(strategies, 0);
        assert.equal(sampler.name(), 'PerOperationSampler');

        let callback = sinon.spy();
        sampler.close(callback);
        assert(callback.calledOnce);

        sampler = new PerOperationSampler(strategies, 0);
        sampler.close(); // close without callback

        sampler.equal(sampler); // for coverate only
    });
    
    it('should parse initial strategies', () => {
        let sampler = new PerOperationSampler(strategies, 2);
        assert.equal(sampler._maxOperations, 2);
        assert.equal(sampler._defaultLowerBound, 1.1);
        assert.isObject(sampler._defaultSampler);
        assert.equal(sampler._defaultSampler.samplingRate, 0.123);
        assert.equal(Object.keys(sampler._samplersByOperation).length, 1);
        let s1 = sampler._samplersByOperation['op1'];
        assert.isObject(s1);
        assert.isObject(s1._probabilisticSampler);
        assert.equal(s1._probabilisticSampler.samplingRate, 0.5);
    });

    it('should use per-op sampler', () => {
        let sampler = new PerOperationSampler(strategies, 2);
        let s1 = sampler._samplersByOperation['op1'];
        let exp = sinon.mock(s1).expects('isSampled');
        exp.exactly(2);
        exp.withExactArgs('op1', {});
        sampler.isSampled('op1', {});
        sampler.isSampled('op1', {});
        exp.verify();
        assert.equal(Object.keys(sampler._samplersByOperation).length, 1);
    });

    it('should add per-op samplers up to maxOperations', () => {
        let sampler = new PerOperationSampler(strategies, 2);
        sampler.isSampled('op2', {});
        assert.equal(Object.keys(sampler._samplersByOperation).length, 2);
    });

    it('should fallback to probabilistic sampler after maxOperations', () => {
        let sampler = new PerOperationSampler(strategies, 1); // maxOperation = 1
        let s1 = sampler._defaultSampler;
        let exp = sinon.mock(s1).expects('isSampled');
        exp.exactly(2);
        sampler.isSampled('op2', {});
        sampler.isSampled('op3', {});
        assert.equal(Object.keys(sampler._samplersByOperation).length, 1);
        exp.verify();
    });

    it('should update samplers', () => {
        let sampler = new PerOperationSampler(strategies, 2);
        let updated: PerOperationSamplingStrategies = {
            defaultLowerBoundTracesPerSecond: 2,
            defaultSamplingProbability: 0.333,
            perOperationStrategies: [
                {
                    operation: 'op1',
                    probabilisticSampling: { samplingRate: 0.01 }
                },
                {
                    operation: 'op2',
                    probabilisticSampling: { samplingRate: 0.001 }
                }
            ]
        };
        let isUpdated: boolean = sampler.update(updated);
        assert.isTrue(isUpdated);
        assert.equal(sampler._defaultLowerBound, 2);
        assert.isObject(sampler._defaultSampler);
        assert.equal(sampler._defaultSampler.samplingRate, 0.333);
        assert.equal(Object.keys(sampler._samplersByOperation).length, 2);
        let s1 = sampler._samplersByOperation['op1'];
        assert.isObject(s1);
        assert.isObject(s1._probabilisticSampler);
        assert.equal(s1._probabilisticSampler.samplingRate, 0.01);
        let s2 = sampler._samplersByOperation['op2'];
        assert.isObject(s2);
        assert.isObject(s2._probabilisticSampler);
        assert.equal(s2._probabilisticSampler.samplingRate, 0.001);
    });

    it('should not update samplers if strategies did not change', () => {
        let strategies: PerOperationSamplingStrategies = {
            defaultLowerBoundTracesPerSecond: 2,
            defaultSamplingProbability: 0.333,
            perOperationStrategies: [
                {
                    operation: 'op1',
                    probabilisticSampling: { samplingRate: 0.01 }
                },
                {
                    operation: 'op2',
                    probabilisticSampling: { samplingRate: 0.001 }
                }
            ]
        };
        let sampler = new PerOperationSampler(strategies, 2);
        let s0 = sampler._defaultSampler;
        let s1 = sampler._samplersByOperation['op1'];
        let s2 = sampler._samplersByOperation['op2'];

        let isUpdated: boolean = sampler.update(strategies);
        assert.isFalse(isUpdated);
        assert.strictEqual(sampler._defaultSampler, s0);
        assert.strictEqual(sampler._samplersByOperation['op1'], s1);
        assert.strictEqual(sampler._samplersByOperation['op2'], s2);
    });
});

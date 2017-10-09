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

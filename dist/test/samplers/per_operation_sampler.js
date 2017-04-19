'use strict';

var _chai = require('chai');

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _per_operation_sampler = require('../../src/samplers/per_operation_sampler');

var _per_operation_sampler2 = _interopRequireDefault(_per_operation_sampler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('PerOperationSampler', function () {

    var strategies = {
        defaultLowerBoundTracesPerSecond: 1.1,
        defaultSamplingProbability: 0.123,
        perOperationStrategies: [{
            operation: 'op1',
            probabilisticSampling: { samplingRate: 0.5 }
        }]
    };

    it('should have a name and be closable', function () {
        var sampler = new _per_operation_sampler2.default(strategies, 0);
        _chai.assert.equal(sampler.name(), 'PerOperationSampler');

        var callback = _sinon2.default.spy();
        sampler.close(callback);
        (0, _chai.assert)(callback.calledOnce);

        sampler = new _per_operation_sampler2.default(strategies, 0);
        sampler.close(); // close without callback

        sampler.equal(sampler); // for coverate only
    });

    it('should parse initial strategies', function () {
        var sampler = new _per_operation_sampler2.default(strategies, 2);
        _chai.assert.equal(sampler._maxOperations, 2);
        _chai.assert.equal(sampler._defaultLowerBound, 1.1);
        _chai.assert.isObject(sampler._defaultSampler);
        _chai.assert.equal(sampler._defaultSampler.samplingRate, 0.123);
        _chai.assert.equal(Object.keys(sampler._samplersByOperation).length, 1);
        var s1 = sampler._samplersByOperation['op1'];
        _chai.assert.isObject(s1);
        _chai.assert.isObject(s1._probabilisticSampler);
        _chai.assert.equal(s1._probabilisticSampler.samplingRate, 0.5);
    });

    it('should use per-op sampler', function () {
        var sampler = new _per_operation_sampler2.default(strategies, 2);
        var s1 = sampler._samplersByOperation['op1'];
        var exp = _sinon2.default.mock(s1).expects('isSampled');
        exp.exactly(2);
        exp.withExactArgs('op1', {});
        sampler.isSampled('op1', {});
        sampler.isSampled('op1', {});
        exp.verify();
        _chai.assert.equal(Object.keys(sampler._samplersByOperation).length, 1);
    });

    it('should add per-op samplers up to maxOperations', function () {
        var sampler = new _per_operation_sampler2.default(strategies, 2);
        sampler.isSampled('op2', {});
        _chai.assert.equal(Object.keys(sampler._samplersByOperation).length, 2);
    });

    it('should fallback to probabilistic sampler after maxOperations', function () {
        var sampler = new _per_operation_sampler2.default(strategies, 1); // maxOperation = 1
        var s1 = sampler._defaultSampler;
        var exp = _sinon2.default.mock(s1).expects('isSampled');
        exp.exactly(2);
        sampler.isSampled('op2', {});
        sampler.isSampled('op3', {});
        _chai.assert.equal(Object.keys(sampler._samplersByOperation).length, 1);
        exp.verify();
    });

    it('should update samplers', function () {
        var sampler = new _per_operation_sampler2.default(strategies, 2);
        var updated = {
            defaultLowerBoundTracesPerSecond: 2,
            defaultSamplingProbability: 0.333,
            perOperationStrategies: [{
                operation: 'op1',
                probabilisticSampling: { samplingRate: 0.01 }
            }, {
                operation: 'op2',
                probabilisticSampling: { samplingRate: 0.001 }
            }]
        };
        var isUpdated = sampler.update(updated);
        _chai.assert.isTrue(isUpdated);
        _chai.assert.equal(sampler._defaultLowerBound, 2);
        _chai.assert.isObject(sampler._defaultSampler);
        _chai.assert.equal(sampler._defaultSampler.samplingRate, 0.333);
        _chai.assert.equal(Object.keys(sampler._samplersByOperation).length, 2);
        var s1 = sampler._samplersByOperation['op1'];
        _chai.assert.isObject(s1);
        _chai.assert.isObject(s1._probabilisticSampler);
        _chai.assert.equal(s1._probabilisticSampler.samplingRate, 0.01);
        var s2 = sampler._samplersByOperation['op2'];
        _chai.assert.isObject(s2);
        _chai.assert.isObject(s2._probabilisticSampler);
        _chai.assert.equal(s2._probabilisticSampler.samplingRate, 0.001);
    });

    it('should not update samplers if strategies did not change', function () {
        var strategies = {
            defaultLowerBoundTracesPerSecond: 2,
            defaultSamplingProbability: 0.333,
            perOperationStrategies: [{
                operation: 'op1',
                probabilisticSampling: { samplingRate: 0.01 }
            }, {
                operation: 'op2',
                probabilisticSampling: { samplingRate: 0.001 }
            }]
        };
        var sampler = new _per_operation_sampler2.default(strategies, 2);
        var s0 = sampler._defaultSampler;
        var s1 = sampler._samplersByOperation['op1'];
        var s2 = sampler._samplersByOperation['op2'];

        var isUpdated = sampler.update(strategies);
        _chai.assert.isFalse(isUpdated);
        _chai.assert.strictEqual(sampler._defaultSampler, s0);
        _chai.assert.strictEqual(sampler._samplersByOperation['op1'], s1);
        _chai.assert.strictEqual(sampler._samplersByOperation['op2'], s2);
    });
});
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
//# sourceMappingURL=per_operation_sampler.js.map
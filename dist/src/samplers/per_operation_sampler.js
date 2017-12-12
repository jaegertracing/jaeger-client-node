'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var _constants = require('../constants.js');

var constants = _interopRequireWildcard(_constants);

var _probabilistic_sampler = require('./probabilistic_sampler.js');

var _probabilistic_sampler2 = _interopRequireDefault(_probabilistic_sampler);

var _guaranteed_throughput_sampler = require('./guaranteed_throughput_sampler.js');

var _guaranteed_throughput_sampler2 = _interopRequireDefault(_guaranteed_throughput_sampler);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// PerOperationSampler keeps track of all operation names it is asked to sample
// and uses GuaranteedThroughputSampler for each operation name to ensure
// that all endpoints are represented in the sampled traces. If the number
// of distinct operation names exceeds maxOperations, all other names are
// sampled with a default probabilistic sampler.
var PerOperationSampler = function () {
    function PerOperationSampler(strategies, maxOperations) {
        _classCallCheck(this, PerOperationSampler);

        this._maxOperations = maxOperations;
        this._samplersByOperation = Object.create(null);
        this.update(strategies);
    }

    _createClass(PerOperationSampler, [{
        key: 'update',
        value: function update(strategies) {
            var _this = this;

            (0, _assert2.default)(typeof strategies.defaultLowerBoundTracesPerSecond === 'number', 'expected strategies.defaultLowerBoundTracesPerSecond to be number');
            (0, _assert2.default)(typeof strategies.defaultSamplingProbability === 'number', 'expected strategies.defaultSamplingProbability to be number');

            var updated = this._defaultLowerBound !== strategies.defaultLowerBoundTracesPerSecond;
            this._defaultLowerBound = strategies.defaultLowerBoundTracesPerSecond;
            strategies.perOperationStrategies.forEach(function (strategy) {
                var operation = strategy.operation;
                var samplingRate = strategy.probabilisticSampling.samplingRate;
                var sampler = _this._samplersByOperation[operation];
                if (sampler) {
                    if (sampler.update(_this._defaultLowerBound, samplingRate)) {
                        updated = true;
                    }
                } else {
                    sampler = new _guaranteed_throughput_sampler2.default(_this._defaultLowerBound, samplingRate);
                    _this._samplersByOperation[operation] = sampler;
                    updated = true;
                }
            });
            var defaultSamplingRate = strategies.defaultSamplingProbability;
            if (!this._defaultSampler || this._defaultSampler.samplingRate != defaultSamplingRate) {
                this._defaultSampler = new _probabilistic_sampler2.default(defaultSamplingRate);
                updated = true;
            }
            return updated;
        }
    }, {
        key: 'name',
        value: function name() {
            return 'PerOperationSampler';
        }
    }, {
        key: 'toString',
        value: function toString() {
            return this.name() + '(maxOperations=' + this._maxOperations + ')';
        }
    }, {
        key: 'isSampled',
        value: function isSampled(operation, tags) {
            var sampler = this._samplersByOperation[operation];
            if (!sampler) {
                if (Object.keys(this._samplersByOperation).length >= this._maxOperations) {
                    return this._defaultSampler.isSampled(operation, tags);
                }
                sampler = new _guaranteed_throughput_sampler2.default(this._defaultLowerBound, this._defaultSampler.samplingRate);
                this._samplersByOperation[operation] = sampler;
            }
            return sampler.isSampled(operation, tags);
        }
    }, {
        key: 'equal',
        value: function equal(other) {
            return false; // TODO equal should be removed
        }
    }, {
        key: 'close',
        value: function close(callback) {
            // all nested samplers are of simple types, so we do not need to Close them
            if (callback) {
                callback();
            }
        }
    }]);

    return PerOperationSampler;
}();

exports.default = PerOperationSampler;
//# sourceMappingURL=per_operation_sampler.js.map
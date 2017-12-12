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

var _constants = require('../constants.js');

var constants = _interopRequireWildcard(_constants);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ProbabilisticSampler = function () {
    function ProbabilisticSampler(samplingRate) {
        _classCallCheck(this, ProbabilisticSampler);

        if (samplingRate < 0.0 || samplingRate > 1.0) {
            throw new Error('The sampling rate must be less than 0.0 and greater than 1.0. Received ' + samplingRate);
        }

        this._samplingRate = samplingRate;
    }

    _createClass(ProbabilisticSampler, [{
        key: 'name',
        value: function name() {
            return 'ProbabilisticSampler';
        }
    }, {
        key: 'toString',
        value: function toString() {
            return this.name() + '(samplingRate=' + this._samplingRate + ')';
        }
    }, {
        key: 'isSampled',
        value: function isSampled(operation, tags) {
            var decision = this.random() < this._samplingRate;
            if (decision) {
                tags[constants.SAMPLER_TYPE_TAG_KEY] = constants.SAMPLER_TYPE_PROBABILISTIC;
                tags[constants.SAMPLER_PARAM_TAG_KEY] = this._samplingRate;
            }
            return decision;
        }
    }, {
        key: 'random',
        value: function random() {
            return Math.random();
        }
    }, {
        key: 'equal',
        value: function equal(other) {
            if (!(other instanceof ProbabilisticSampler)) {
                return false;
            }

            return this.samplingRate === other.samplingRate;
        }
    }, {
        key: 'close',
        value: function close(callback) {
            if (callback) {
                callback();
            }
        }
    }, {
        key: 'samplingRate',
        get: function get() {
            return this._samplingRate;
        }
    }]);

    return ProbabilisticSampler;
}();

exports.default = ProbabilisticSampler;
//# sourceMappingURL=probabilistic_sampler.js.map
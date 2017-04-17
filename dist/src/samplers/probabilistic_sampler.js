'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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
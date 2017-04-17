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

var _probabilistic_sampler = require('./probabilistic_sampler.js');

var _probabilistic_sampler2 = _interopRequireDefault(_probabilistic_sampler);

var _ratelimiting_sampler = require('./ratelimiting_sampler.js');

var _ratelimiting_sampler2 = _interopRequireDefault(_ratelimiting_sampler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// GuaranteedThroughputProbabilisticSampler is a sampler that leverages both probabilisticSampler and
// rateLimitingSampler. The rateLimitingSampler is used as a guaranteed lower bound sampler such that
// every operation is sampled at least once in a time interval defined by the lowerBound. ie a lowerBound
// of 1.0 / (60 * 10) will sample an operation at least once every 10 minutes.
//
// The probabilisticSampler is given higher priority when tags are emitted, ie. if IsSampled() for both
// samplers return true, the tags for probabilisticSampler will be used.
var GuaranteedThroughputSampler = function () {
    function GuaranteedThroughputSampler(lowerBound, samplingRate) {
        _classCallCheck(this, GuaranteedThroughputSampler);

        this._probabilisticSampler = new _probabilistic_sampler2.default(samplingRate);
        this._lowerBoundSampler = new _ratelimiting_sampler2.default(lowerBound);
        // we never let the lowerBoundSampler return its real tags, so avoid allocations
        // by reusing the same placeholder object
        this._tagsPlaceholder = {};
    }

    _createClass(GuaranteedThroughputSampler, [{
        key: 'name',
        value: function name() {
            return 'GuaranteedThroughputSampler';
        }
    }, {
        key: 'toString',
        value: function toString() {
            return this.name() + '(samplingRate=' + this._probabilisticSampler.samplingRate + ', lowerBound=' + this._lowerBoundSampler.maxTracesPerSecond + ')';
        }
    }, {
        key: 'isSampled',
        value: function isSampled(operation, tags) {
            if (this._probabilisticSampler.isSampled(operation, tags)) {
                // make rate limiting sampler update its budget
                this._lowerBoundSampler.isSampled(operation, this._tagsPlaceholder);
                return true;
            }
            var decision = this._lowerBoundSampler.isSampled(operation, this._tagsPlaceholder);
            if (decision) {
                tags[constants.SAMPLER_TYPE_TAG_KEY] = constants.SAMPLER_TYPE_LOWER_BOUND;
                tags[constants.SAMPLER_PARAM_TAG_KEY] = this._probabilisticSampler.samplingRate;
            }
            return decision;
        }
    }, {
        key: 'equal',
        value: function equal(other) {
            if (!(other instanceof GuaranteedThroughputSampler)) {
                return false;
            }
            return this._probabilisticSampler.equal(other._probabilisticSampler) && this._lowerBoundSampler.equal(other._lowerBoundSampler);
        }
    }, {
        key: 'close',
        value: function close(callback) {
            // neither probabilistic nor rate limiting samplers allocate resources,
            // so their close methods are effectively no-op. We do not need to
            // pass the callback to them (if we did we'd need to wrap it).
            this._probabilisticSampler.close(function () {});
            this._lowerBoundSampler.close(function () {});
            if (callback) {
                callback();
            }
        }
    }, {
        key: 'update',
        value: function update(lowerBound, samplingRate) {
            var updated = false;
            if (this._probabilisticSampler.samplingRate != samplingRate) {
                this._probabilisticSampler = new _probabilistic_sampler2.default(samplingRate);
                updated = true;
            }
            if (this._lowerBoundSampler.maxTracesPerSecond != lowerBound) {
                this._lowerBoundSampler = new _ratelimiting_sampler2.default(lowerBound);
                updated = true;
            }
            return updated;
        }
    }]);

    return GuaranteedThroughputSampler;
}();

exports.default = GuaranteedThroughputSampler;
//# sourceMappingURL=guaranteed_throughput_sampler.js.map
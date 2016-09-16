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

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _probabilistic_sampler = require('./probabilistic_sampler.js');

var _probabilistic_sampler2 = _interopRequireDefault(_probabilistic_sampler);

var _ratelimiting_sampler = require('./ratelimiting_sampler.js');

var _ratelimiting_sampler2 = _interopRequireDefault(_ratelimiting_sampler);

var _logger = require('../logger.js');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DEFAULT_INITIAL_SAMPLING_RATE = 0.001;
var SAMPLING_REFRESH_INTERVAL = 60000;
var DEFAULT_SAMPLING_HOST = '0.0.0.0';
var DEFAULT_SAMPLING_PORT = 5778;
var PROBABILISTIC_STRATEGY_TYPE = 0;
var RATELIMITING_STRATEGY_TYPE = 1;

var RemoteControlledSampler = function () {
    function RemoteControlledSampler(callerName) {
        var _this = this;

        var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        _classCallCheck(this, RemoteControlledSampler);

        this._callerName = callerName;
        this._sampler = options.sampler || new _probabilistic_sampler2.default(DEFAULT_INITIAL_SAMPLING_RATE);
        this._logger = options.logger || new _logger2.default();
        this._refreshInterval = options.refreshInterval || SAMPLING_REFRESH_INTERVAL;

        var randomDelay = Math.random() * this._refreshInterval;
        this._onSamplerUpdate = options.onSamplerUpdate;
        this._host = options.host || DEFAULT_SAMPLING_HOST;
        this._port = options.port || DEFAULT_SAMPLING_PORT;

        if (!options.stopPolling) {
            this._timeoutHandle = setTimeout(function () {
                _this._intervalHandle = setInterval(_this._refreshSamplingStrategy.bind(_this), _this._refreshInterval);
            }, randomDelay);
        }
    }

    _createClass(RemoteControlledSampler, [{
        key: '_refreshSamplingStrategy',
        value: function _refreshSamplingStrategy() {
            this._getSamplingStrategy(this._callerName);
        }
    }, {
        key: '_getSamplingStrategy',
        value: function _getSamplingStrategy(callerName) {
            var _this2 = this;

            var encodedCaller = encodeURIComponent(callerName);
            _request2.default.get('http://' + this._host + ':' + this._port + '/?service=' + encodedCaller, function (err, response) {
                if (err) {
                    _this2._logger.error('Error in fetching sampling strategy.');
                    return null;
                }

                var strategy = JSON.parse(response.body);
                _this2._setSampler(strategy);
            });
        }
    }, {
        key: '_setSampler',
        value: function _setSampler(strategy) {
            if (!strategy) {
                return;
            }

            var newSampler = void 0;
            if (strategy.strategyType === PROBABILISTIC_STRATEGY_TYPE && strategy.probabilisticSampling) {
                var samplingRate = strategy.probabilisticSampling.samplingRate;
                newSampler = new _probabilistic_sampler2.default(samplingRate);
            } else if (strategy.strategyType === RATELIMITING_STRATEGY_TYPE && strategy.rateLimitingSampling) {
                var maxTracesPerSecond = strategy.rateLimitingSampling.maxTracesPerSecond;
                newSampler = new _ratelimiting_sampler2.default(maxTracesPerSecond);
            } else {
                this._logger.error('Unrecognized strategy type: ' + JSON.stringify({ error: strategy }));
            }

            if (newSampler && !this._sampler.equal(newSampler)) {
                this._sampler = newSampler;
            }

            if (this._onSamplerUpdate) {
                this._onSamplerUpdate(this._sampler);
            }
        }
    }, {
        key: 'isSampled',
        value: function isSampled() {
            return this._sampler.isSampled();
        }
    }, {
        key: 'getTags',
        value: function getTags() {
            return this._sampler.getTags();
        }
    }, {
        key: 'close',
        value: function close(callback) {
            clearTimeout(this._timeoutHandle);
            clearInterval(this._intervalHandle);

            if (callback) {
                callback();
            }
        }
    }]);

    return RemoteControlledSampler;
}();

exports.default = RemoteControlledSampler;
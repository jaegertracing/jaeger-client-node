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

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _probabilistic_sampler = require('./probabilistic_sampler.js');

var _probabilistic_sampler2 = _interopRequireDefault(_probabilistic_sampler);

var _ratelimiting_sampler = require('./ratelimiting_sampler.js');

var _ratelimiting_sampler2 = _interopRequireDefault(_ratelimiting_sampler);

var _per_operation_sampler = require('./per_operation_sampler.js');

var _per_operation_sampler2 = _interopRequireDefault(_per_operation_sampler);

var _metrics = require('../metrics/metrics.js');

var _metrics2 = _interopRequireDefault(_metrics);

var _logger = require('../logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _metric_factory = require('../metrics/noop/metric_factory');

var _metric_factory2 = _interopRequireDefault(_metric_factory);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DEFAULT_INITIAL_SAMPLING_RATE = 0.001;
var DEFAULT_REFRESH_INTERVAL = 60000;
var DEFAULT_MAX_OPERATIONS = 2000;
var DEFAULT_SAMPLING_HOST = '0.0.0.0';
var DEFAULT_SAMPLING_PORT = 5778;
var PROBABILISTIC_STRATEGY_TYPE = 0;
var RATELIMITING_STRATEGY_TYPE = 1;

var RemoteControlledSampler = function () {

    /**
     * Creates a sampler remotely controlled by jaeger-agent.
     *
     * @param {string} [serviceName] - name of the current service / application, same as given to Tracer
     * @param {object} [options] - optional settings
     * @param {object} [options.sampler] - initial sampler to use prior to retrieving strategies from Agent
     * @param {object} [options.logger] - optional logger, see _flow/logger.js
     * @param {object} [options.metrics] - instance of Metrics object
     * @param {number} [options.refreshInterval] - interval in milliseconds before sampling strategy refreshes (0 to not refresh)
     * @param {string} [options.host] - host for jaeger-agent, defaults to 'localhost'
     * @param {number} [options.port] - port for jaeger-agent for SamplingManager endpoint
     * @param {number} [options.maxOperations] - max number of operations to track in PerOperationSampler
     * @param {function} [options.onSamplerUpdate]
     */
    function RemoteControlledSampler(serviceName) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        _classCallCheck(this, RemoteControlledSampler);

        this._serviceName = serviceName;
        this._sampler = options.sampler || new _probabilistic_sampler2.default(DEFAULT_INITIAL_SAMPLING_RATE);
        this._logger = options.logger || new _logger2.default();
        this._metrics = new _metrics2.default(new _metric_factory2.default());
        this._refreshInterval = options.refreshInterval || DEFAULT_REFRESH_INTERVAL;
        this._host = options.host || DEFAULT_SAMPLING_HOST;
        this._port = options.port || DEFAULT_SAMPLING_PORT;
        this._maxOperations = options.maxOperations || DEFAULT_MAX_OPERATIONS;

        this._onSamplerUpdate = options.onSamplerUpdate;

        this._logger.error('JAEGER: Refresh interval is ' + options.refreshInterval);

        if (options.refreshInterval !== 0) {
            this._logger.error('JAEGER: Random delay start');
            var randomDelay = Math.random() * this._refreshInterval;
            this._initialDelayTimeoutHandle = setTimeout(this._afterInitialDelay.bind(this), randomDelay);
        }
    }

    _createClass(RemoteControlledSampler, [{
        key: 'name',
        value: function name() {
            return 'RemoteSampler';
        }
    }, {
        key: 'toString',
        value: function toString() {
            return this.name() + '(serviceName=' + this._serviceName + ')';
        }
    }, {
        key: '_afterInitialDelay',
        value: function _afterInitialDelay() {
            this._refreshIntervalHandle = setInterval(this._refreshSamplingStrategy.bind(this), this._refreshInterval);
        }
    }, {
        key: '_refreshSamplingStrategy',
        value: function _refreshSamplingStrategy() {
            var _this = this;

            this._logger.error('JAEGER: refreshSamplingStrategy');
            var serviceName = encodeURIComponent(this._serviceName);
            _http2.default.get({
                'host': this._host,
                'port': this._port,
                'path': '/sampling?service=' + serviceName
            }, function (res) {
                // explicitly treat incoming data as utf8 (avoids issues with multi-byte chars)
                res.setEncoding('utf8');

                // incrementally capture the incoming response body
                var body = '';
                res.on('data', function (chunk) {
                    body += chunk;
                });

                res.on('end', function () {
                    _this._logger.error('JAEGER: retrieved sampling strategy from agent', body);
                    _this._logger.error('JAEGER: service is: ' + serviceName);
                    _this._parseSamplingServerResponse(body);
                });
            }).on('error', function (err) {
                _this._logger.error('Error in fetching sampling strategy: ' + err + '.');
                _this._metrics.samplerQueryFailure.increment(1);
            });
        }
    }, {
        key: '_parseSamplingServerResponse',
        value: function _parseSamplingServerResponse(body) {
            this._logger.error('JAEGER: parseSamplingServerResponse');
            this._logger.error('JAEGER: a');
            this._metrics.samplerRetrieved.increment(1);
            this._logger.error('JAEGER: b');
            var strategy = void 0;
            this._logger.error('JAEGER: parseSamplingServerResponse TRY 1');
            try {
                strategy = JSON.parse(body);
                if (!strategy) {
                    this._logger.error('JAEGER: Malformed response!!!!!!!');
                    throw 'Malformed response: ' + body;
                }
            } catch (error) {
                this._logger.error('Error in parsing sampling strategy: ' + error + '.');
                this._metrics.samplerParsingFailure.increment(1);
                return;
            }
            this._logger.error('JAEGER: TRY 1 PASS');
            this._logger.error('JAEGER: TRY 2');
            this._logger.error('JAEGER: PRE sampler: ' + this._sampler.toString() + '.');
            try {
                if (this._updateSampler(strategy)) {
                    this._metrics.samplerUpdated.increment(1);
                }
            } catch (error) {
                this._logger.error('Error in updating sampler: ' + error + '.');
                this._metrics.samplerParsingFailure.increment(1);
                return;
            }
            this._logger.error('JAEGER: TRY 2 PASS');
            this._logger.error('JAEGER: POST sampler: ' + this._sampler.toString() + '.');
            if (this._onSamplerUpdate) {
                this._onSamplerUpdate(this._sampler);
            }
        }
    }, {
        key: '_updateSampler',
        value: function _updateSampler(response) {
            this._logger.error('JAEGER: updateSampler.');
            if (response.operationSampling) {
                if (this._sampler instanceof _per_operation_sampler2.default) {
                    var sampler = this._sampler;
                    return sampler.update(response.operationSampling);
                }
                this._sampler = new _per_operation_sampler2.default(response.operationSampling, this._maxOperations);
                return true;
            }
            var newSampler = void 0;
            this._logger.error('JAEGER: updateSampler TRY');
            this._logger.error('JAEGER: updateSampler response: ' + response.strategyType);
            if ((response.strategyType === PROBABILISTIC_STRATEGY_TYPE || response.strategyType === 'PROBABILISTIC') && response.probabilisticSampling) {
                var samplingRate = response.probabilisticSampling.samplingRate;
                this._logger.error('JAEGER: probabilisticSampler: ' + samplingRate.toString() + '.');
                newSampler = new _probabilistic_sampler2.default(samplingRate);
            } else if (response.strategyType === RATELIMITING_STRATEGY_TYPE && response.rateLimitingSampling) {
                var maxTracesPerSecond = response.rateLimitingSampling.maxTracesPerSecond;
                this._logger.error('JAEGER: rateLimitingSampler ' + maxTracesPerSecond.toString() + '.');
                newSampler = new _ratelimiting_sampler2.default(maxTracesPerSecond);
            } else {
                this._logger.error('JAEGER: updateSampler Malformed response');
                throw 'Malformed response: ' + JSON.stringify(response);
            }
            this._logger.error('JAEGER: updateSampler End');
            this._logger.error('JAEGER: new Sampler: ' + newSampler.toString() + '.');

            if (this._sampler.equal(newSampler)) {
                this._logger.error('JAEGER: Not updating sampler');
                return false;
            }
            this._logger.error('JAEGER: Updating sampler');
            this._sampler = newSampler;
            return true;
        }
    }, {
        key: 'isSampled',
        value: function isSampled(operation, tags) {
            return this._sampler.isSampled(operation, tags);
        }
    }, {
        key: 'close',
        value: function close(callback) {
            clearTimeout(this._initialDelayTimeoutHandle);
            clearInterval(this._refreshIntervalHandle);

            if (callback) {
                callback();
            }
        }
    }]);

    return RemoteControlledSampler;
}();

exports.default = RemoteControlledSampler;
//# sourceMappingURL=remote_sampler.js.map
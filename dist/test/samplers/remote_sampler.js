'use strict';

var _chai = require('chai');

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _metrics = require('../../src/metrics/metrics.js');

var _metrics2 = _interopRequireDefault(_metrics);

var _ratelimiting_sampler = require('../../src/samplers/ratelimiting_sampler');

var _ratelimiting_sampler2 = _interopRequireDefault(_ratelimiting_sampler);

var _probabilistic_sampler = require('../../src/samplers/probabilistic_sampler.js');

var _probabilistic_sampler2 = _interopRequireDefault(_probabilistic_sampler);

var _per_operation_sampler = require('../../src/samplers/per_operation_sampler');

var _per_operation_sampler2 = _interopRequireDefault(_per_operation_sampler);

var _remote_sampler = require('../../src/samplers/remote_sampler');

var _remote_sampler2 = _interopRequireDefault(_remote_sampler);

var _mock_logger = require('../lib/mock_logger');

var _mock_logger2 = _interopRequireDefault(_mock_logger);

var _sampler_server = require('../lib/sampler_server');

var _sampler_server2 = _interopRequireDefault(_sampler_server);

var _metric_factory = require('../lib/metrics/local/metric_factory.js');

var _metric_factory2 = _interopRequireDefault(_metric_factory);

var _backend = require('../lib/metrics/local/backend.js');

var _backend2 = _interopRequireDefault(_backend);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('RemoteSampler', function () {
    var server = void 0;
    var logger = void 0;
    var metrics = void 0;
    var remoteSampler = void 0;

    before(function () {
        server = new _sampler_server2.default().start();
    });

    after(function () {
        server.close();
    });

    beforeEach(function () {
        server.clearStrategies();
        logger = new _mock_logger2.default();
        metrics = new _metrics2.default(new _metric_factory2.default());
        remoteSampler = new _remote_sampler2.default('service1', {
            refreshInterval: 0,
            metrics: metrics,
            logger: logger
        });
    });

    afterEach(function () {
        remoteSampler.close();
    });

    it('should log metric on failing to query for sampling strategy', function (done) {
        metrics.samplerQueryFailure.increment = function () {
            _chai.assert.equal(logger._errorMsgs.length, 1, 'errors=' + logger._errorMsgs);
            done();
        };
        remoteSampler._host = 'fake-host';
        remoteSampler._refreshSamplingStrategy();
    });

    var badResponses = ['junk', '0', 'false', {}];
    badResponses.forEach(function (resp) {
        it('should log metric on failing to parse bad http response ' + resp, function (done) {
            metrics.samplerParsingFailure.increment = function () {
                _chai.assert.equal(logger._errorMsgs.length, 1, 'errors=' + logger._errorMsgs);
                done();
            };
            server.addStrategy('service1', resp);
            remoteSampler._refreshSamplingStrategy();
        });
    });

    it('should throw error on bad sampling strategy', function (done) {
        metrics.samplerParsingFailure.increment = function () {
            _chai.assert.equal(logger._errorMsgs.length, 1);
            done();
        };
        remoteSampler._serviceName = 'bad-service';
        remoteSampler._refreshSamplingStrategy();
    });

    it('should set probabilistic sampler, but only once', function (done) {
        remoteSampler._onSamplerUpdate = function (s) {
            _chai.assert.equal(s._samplingRate, 1.0);
            _chai.assert.equal(_backend2.default.counterValue(metrics.samplerRetrieved), 1);
            _chai.assert.equal(_backend2.default.counterValue(metrics.samplerUpdated), 1);

            var firstSampler = s;

            // prepare for second update
            remoteSampler._onSamplerUpdate = function (s) {
                _chai.assert.strictEqual(s, firstSampler, 'must not have changed the sampler');

                _chai.assert.equal(_backend2.default.counterValue(metrics.samplerRetrieved), 2);
                _chai.assert.equal(_backend2.default.counterValue(metrics.samplerUpdated), 1);

                // prepare for third update - for test coverage only
                remoteSampler._onSamplerUpdate = null;
                remoteSampler._refreshSamplingStrategy();

                done();
            };

            remoteSampler._refreshSamplingStrategy();
        };
        server.addStrategy('service1', {
            strategyType: 'PROBABILISTIC',
            probabilisticSampling: {
                samplingRate: 1.0
            }
        });
        remoteSampler._refreshSamplingStrategy();
    });

    it('should set ratelimiting sampler', function (done) {
        var maxTracesPerSecond = 10;
        remoteSampler._onSamplerUpdate = function (s) {
            _chai.assert.isOk(s.equal(new _ratelimiting_sampler2.default(maxTracesPerSecond)));
            done();
        };
        server.addStrategy('service1', {
            strategyType: 'RATE_LIMITING',
            rateLimitingSampling: {
                maxTracesPerSecond: maxTracesPerSecond
            }
        });
        remoteSampler._refreshSamplingStrategy();
    });

    it('should set per-operation sampler', function (done) {
        server.addStrategy('service1', {
            strategyType: 'PROBABILISTIC',
            probabilisticSampling: {
                samplingRate: 1.0
            },
            operationSampling: {
                defaultSamplingProbability: 0.05,
                defaultLowerBoundTracesPerSecond: 0.1,
                perOperationStrategies: []
            }
        });
        remoteSampler._onSamplerUpdate = function (s) {
            _chai.assert.isOk(s instanceof _per_operation_sampler2.default);
            _chai.assert.equal(_backend2.default.counterValue(metrics.samplerRetrieved), 1);
            _chai.assert.equal(_backend2.default.counterValue(metrics.samplerUpdated), 1);

            // cause a second refresh without changes
            remoteSampler._onSamplerUpdate = function (s2) {
                _chai.assert.strictEqual(s2, s);
                _chai.assert.equal(_backend2.default.counterValue(metrics.samplerRetrieved), 2, 'second retrieval');
                _chai.assert.equal(_backend2.default.counterValue(metrics.samplerUpdated), 1, 'but no update');
                done();
            };
            remoteSampler._refreshSamplingStrategy();
        };
        remoteSampler._refreshSamplingStrategy();
    });

    it('should refresh periodically', function (done) {
        server.addStrategy('service1', {
            strategyType: 'PROBABILISTIC',
            probabilisticSampling: {
                samplingRate: 0.777
            }
        });

        var clock = _sinon2.default.useFakeTimers();

        var sampler = new _remote_sampler2.default('service1', {
            refreshInterval: 10, // 10ms
            metrics: metrics,
            logger: logger,
            onSamplerUpdate: function onSamplerUpdate(s) {
                _chai.assert.notEqual(_backend2.default.counterValue(metrics.samplerRetrieved), 0);
                _chai.assert.notEqual(_backend2.default.counterValue(metrics.samplerUpdated), 0);
                _chai.assert.equal(logger._errorMsgs.length, 0, 'number of error logs');
                _chai.assert.isTrue(sampler._sampler.equal(new _probabilistic_sampler2.default(0.777)), sampler._sampler.toString());

                clock.restore();

                sampler._onSamplerUpdate = null;
                sampler.close(done);
            }
        });

        clock.tick(20);
    });
}); // Copyright (c) 2016 Uber Technologies, Inc.
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
//# sourceMappingURL=remote_sampler.js.map
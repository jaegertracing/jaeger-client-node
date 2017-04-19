'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _chai = require('chai');

var _noop_reporter = require('../src/reporters/noop_reporter');

var _noop_reporter2 = _interopRequireDefault(_noop_reporter);

var _composite_reporter = require('../src/reporters/composite_reporter');

var _composite_reporter2 = _interopRequireDefault(_composite_reporter);

var _remote_reporter = require('../src/reporters/remote_reporter');

var _remote_reporter2 = _interopRequireDefault(_remote_reporter);

var _const_sampler = require('../src/samplers/const_sampler');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _probabilistic_sampler = require('../src/samplers/probabilistic_sampler');

var _probabilistic_sampler2 = _interopRequireDefault(_probabilistic_sampler);

var _remote_sampler = require('../src/samplers/remote_sampler');

var _remote_sampler2 = _interopRequireDefault(_remote_sampler);

var _ratelimiting_sampler = require('../src/samplers/ratelimiting_sampler');

var _ratelimiting_sampler2 = _interopRequireDefault(_ratelimiting_sampler);

var _index = require('../src/index.js');

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('initTracer', function () {
    it('should initialize noop tracer when disable is set', function () {
        var config = {
            serviceName: 'test-service',
            disable: true
        };
        var tracer = (0, _index.initTracer)(config);

        (0, _chai.expect)(tracer).to.be.an.instanceof(_opentracing2.default.Tracer);
    });

    it('should initialize normal tracer when only service name given', function () {
        var config = {
            serviceName: 'test-service'
        };
        var tracer = (0, _index.initTracer)(config);

        (0, _chai.expect)(tracer._sampler).to.be.an.instanceof(_remote_sampler2.default);
        (0, _chai.expect)(tracer._reporter).to.be.an.instanceof(_remote_reporter2.default);
    });

    it('should initialize proper samplers', function () {
        var config = {
            serviceName: 'test-service'
        };
        var options = [{ type: 'const', param: 1, expectedType: _const_sampler2.default, expectedParam: 1 }, { type: 'ratelimiting', param: 2, expectedType: _ratelimiting_sampler2.default, expectedParam: 2 }, { type: 'probabilistic', param: 0.5, expectedType: _probabilistic_sampler2.default, expectedParam: 0.5 }, { type: 'remote', param: 1, expectedType: _remote_sampler2.default, expectedParam: 1 }];

        _lodash2.default.each(options, function (samplerConfig) {
            var expectedType = samplerConfig.expectedType;
            var expectedParam = samplerConfig.expectedParam;
            delete samplerConfig.expectedType;
            delete samplerConfig.expectedParam;

            config.sampler = samplerConfig;
            var tracer = (0, _index.initTracer)(config);

            (0, _chai.expect)(tracer._sampler).to.be.an.instanceof(expectedType);
            // TODO(oibe:head) test utils for expectedParam here?
        });
    });

    it('should throw error on sampler incorrect type', function () {
        var config = {
            serviceName: 'test-service'
        };
        var options = [{ type: 'const', param: 'bad-value' }, { type: 'ratelimiting', param: 'bad-value' }, { type: 'probabilistic', param: 'bad-value' }, { type: 'remote', param: 'bad-value' }];

        var count = 0;
        _lodash2.default.each(options, function (samplerConfig) {
            config.sampler = samplerConfig;

            // Since its an error from a third party framework, its hard to assert on
            // using expect.
            try {
                (0, _index.initTracer)(config);
            } catch (err) {
                count += 1;
            }
        });

        _chai.assert.equal(count, 4);
    });

    it('should respect reporter options', function () {
        var config = {
            serviceName: 'test-service',
            sampler: {
                type: 'const',
                param: 0
            },
            reporter: {
                logSpans: true,
                agentHost: '127.0.0.1',
                agentPort: 4939,
                flushIntervalMs: 2000
            }
        };
        var tracer = (0, _index.initTracer)(config);

        (0, _chai.expect)(tracer._reporter).to.be.an.instanceof(_composite_reporter2.default);
        var remoteReporter = void 0;
        for (var i = 0; i < tracer._reporter._reporters.length; i++) {
            var reporter = tracer._reporter._reporters[i];
            if (reporter instanceof _remote_reporter2.default) {
                remoteReporter = reporter;
                break;
            }
        }

        _chai.assert.equal(remoteReporter._bufferFlushInterval, 2000);
        _chai.assert.equal(remoteReporter._sender._host, '127.0.0.1');
        _chai.assert.equal(remoteReporter._sender._port, 4939);
    });

    it('should pass options to tracer', function () {
        var logger = {
            'info': function info(msg) {}
        };
        var metrics = {
            'createCounter': function createCounter() {
                return {};
            },
            'createGauge': function createGauge() {
                return {};
            },
            'createTimer': function createTimer() {
                return {};
            }
        };
        var tracer = (0, _index.initTracer)({
            serviceName: 'test-service'
        }, {
            logger: logger,
            metrics: metrics,
            tags: {
                'x': 'y'
            }
        });
        _chai.assert.equal(tracer._logger, logger);
        _chai.assert.equal(tracer._metrics._factory, metrics);
        _chai.assert.equal(tracer._tags['x'], 'y');
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
//# sourceMappingURL=init_tracer.js.map
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // Copyright (c) 2016 Uber Technologies, Inc.
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

var _const_sampler = require('./samplers/const_sampler');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _probabilistic_sampler = require('./samplers/probabilistic_sampler');

var _probabilistic_sampler2 = _interopRequireDefault(_probabilistic_sampler);

var _ratelimiting_sampler = require('./samplers/ratelimiting_sampler');

var _ratelimiting_sampler2 = _interopRequireDefault(_ratelimiting_sampler);

var _remote_reporter = require('./reporters/remote_reporter');

var _remote_reporter2 = _interopRequireDefault(_remote_reporter);

var _composite_reporter = require('./reporters/composite_reporter');

var _composite_reporter2 = _interopRequireDefault(_composite_reporter);

var _logging_reporter = require('./reporters/logging_reporter');

var _logging_reporter2 = _interopRequireDefault(_logging_reporter);

var _remote_sampler = require('./samplers/remote_sampler');

var _remote_sampler2 = _interopRequireDefault(_remote_sampler);

var _metrics = require('./metrics/metrics');

var _metrics2 = _interopRequireDefault(_metrics);

var _tracer = require('./tracer');

var _tracer2 = _interopRequireDefault(_tracer);

var _udp_sender = require('./reporters/udp_sender');

var _udp_sender2 = _interopRequireDefault(_udp_sender);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _constants = require('./constants.js');

var constants = _interopRequireWildcard(_constants);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var jaegerSchema = {
    'id': '/jaeger',
    'type': 'object',
    'properties': {
        'serviceName': { 'type': 'string' },
        'disable': { 'type': 'boolean' },
        'sampler': {
            'properties': {
                'type': { 'type': 'string' },
                'param': { 'type': 'number' },
                'host': { 'type': 'string' },
                'port': { 'type': 'number' },
                'refreshIntervalMs': { 'type': 'number' }
            },
            'required': ['type', 'param'],
            'additionalProperties': false
        },
        'reporter': {
            'properties': {
                'logSpans': { 'type': 'boolean' },
                'agentHost': { 'type': 'string' },
                'agentPort': { 'type': 'number' },
                'flushIntervalMs': { 'type': 'number' }
            },
            'additionalProperties': false
        }
    }
};

var Configuration = function () {
    function Configuration() {
        _classCallCheck(this, Configuration);
    }

    _createClass(Configuration, null, [{
        key: '_getSampler',
        value: function _getSampler(config) {
            var type = config.sampler.type;
            var param = config.sampler.param;
            var host = config.sampler.host;
            var port = config.sampler.port;
            var refreshIntervalMs = config.sampler.refreshIntervalMs;

            if (typeof param !== 'number') {
                throw new Error('Expecting sampler.param to be a number. Received ' + param);
            }

            var sampler = void 0;
            if (type === constants.SAMPLER_TYPE_PROBABILISTIC) {
                sampler = new _probabilistic_sampler2.default(param);
            }

            if (type === constants.SAMPLER_TYPE_RATE_LIMITING) {
                sampler = new _ratelimiting_sampler2.default(param);
            }

            if (type === constants.SAMPLER_TYPE_CONST) {
                sampler = new _const_sampler2.default(param === 1);
            }

            if (type === constants.SAMPLER_TYPE_REMOTE) {
                sampler = new _remote_sampler2.default(config.serviceName, {
                    sampler: new _probabilistic_sampler2.default(param),
                    host: host,
                    port: port,
                    refreshInterval: refreshIntervalMs
                });
            }

            return sampler;
        }
    }, {
        key: '_getReporter',
        value: function _getReporter(config, options) {
            var reporterConfig = {};
            var reporters = [];
            var senderConfig = {
                'logger': config.logger
            };
            if (config.reporter) {
                if (config.reporter.logSpans) {
                    reporters.push(new _logging_reporter2.default(options.logger));
                }

                if (config.reporter.flushIntervalMs) {
                    reporterConfig['bufferFlushInterval'] = config.reporter.flushIntervalMs;
                }

                if (config.reporter.agentHost) {
                    senderConfig['host'] = config.reporter.agentHost;
                }

                if (config.reporter.agentPort) {
                    senderConfig['port'] = config.reporter.agentPort;
                }
            }
            var sender = new _udp_sender2.default(senderConfig);
            var remoteReporter = new _remote_reporter2.default(sender, reporterConfig);
            if (reporters.length == 0) {
                return remoteReporter;
            }
            reporters.push(remoteReporter);
            return new _composite_reporter2.default(reporters);
        }

        /**
         * Initialize and return a new instance of Jaeger Tracer.
         * 
         * The config dictionary is not validated for adherence to the schema above.
         * Such validation can be performed like this:
         * 
         *     import {Validator} from 'jsonschema';
         * 
         *     let v = new Validator();
         *     v.validate(config, jaegerSchema, {
         *       throwError: true
         *     });
         * 
         * @param {Object} config - configuration matching the jaegerSchema definition.
         * @param {Object} options - options
         * @param {Object} [options.reporter] - if provided, this reporter will be used.
         *        Otherwise a new reporter will be created according to the description
         *        in the config.
         * @param {Object} [options.metrics] - a metrics factory (see ./_flow/metrics.js)
         * @param {Object} [options.logger] - a logger (see ./_flow/logger.js)
         * @param {Object} [options.tags] - set of key-value pairs which will be set
         *        as process-level tags on the Tracer itself.
         */

    }, {
        key: 'initTracer',
        value: function initTracer(config) {
            var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

            var reporter = void 0;
            var sampler = void 0;
            if (options.metrics) {
                options.metrics = new _metrics2.default(options.metrics);
            }
            if (config.disable) {
                return new _opentracing2.default.Tracer();
            } else {
                if (config.sampler) {
                    sampler = Configuration._getSampler(config);
                } else {
                    sampler = new _remote_sampler2.default(config.serviceName, options);
                }

                if (!options.reporter) {
                    reporter = Configuration._getReporter(config, options);
                } else {
                    reporter = options.reporter;
                }
            }

            if (options.logger) {
                options.logger.info('Initializing Jaeger Tracer with ' + reporter.name() + ' and ' + sampler.name());
            }

            return new _tracer2.default(config.serviceName, reporter, sampler, {
                metrics: options.metrics,
                logger: options.logger,
                tags: options.tags
            });
        }
    }]);

    return Configuration;
}();

exports.default = Configuration;
//# sourceMappingURL=configuration.js.map
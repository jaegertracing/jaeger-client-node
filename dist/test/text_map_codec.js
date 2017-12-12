'use strict';

var _chai = require('chai');

var _constants = require('../src/constants.js');

var constants = _interopRequireWildcard(_constants);

var _const_sampler = require('../src/samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _in_memory_reporter = require('../src/reporters/in_memory_reporter.js');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _tracer = require('../src/tracer.js');

var _tracer2 = _interopRequireDefault(_tracer);

var _metrics = require('../src/metrics/metrics.js');

var _metrics2 = _interopRequireDefault(_metrics);

var _metric_factory = require('./lib/metrics/local/metric_factory.js');

var _metric_factory2 = _interopRequireDefault(_metric_factory);

var _backend = require('./lib/metrics/local/backend.js');

var _backend2 = _interopRequireDefault(_backend);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

describe('Text Map Codec should', function () {
    it('report metric when failing to decode tracer state', function () {
        var metrics = new _metrics2.default(new _metric_factory2.default());
        var tracer = new _tracer2.default('test-tracer', new _in_memory_reporter2.default(), new _const_sampler2.default(false), {
            metrics: metrics
        });

        var headers = {
            'uber-trace-id': 'bad-value'
        };
        var context = tracer.extract(_opentracing2.default.FORMAT_HTTP_HEADERS, headers);

        _chai.assert.isOk(context);
        _chai.assert.isOk(_backend2.default.counterEquals(metrics.decodingErrors, 1));
    });

    it('set debug flag when debug-id-header is received', function () {
        var metrics = new _metrics2.default(new _metric_factory2.default());
        var tracer = new _tracer2.default('test-tracer', new _in_memory_reporter2.default(), new _const_sampler2.default(false), {
            metrics: metrics
        });
        var headers = {};
        headers[constants.JAEGER_DEBUG_HEADER] = encodeURIComponent('value1');

        var context = tracer.extract(_opentracing2.default.FORMAT_HTTP_HEADERS, headers);
        _chai.assert.isOk(context.isDebugIDContainerOnly());
        _chai.assert.equal(context.debugId, 'value1');

        var span = tracer.startSpan("root", { childOf: context });

        _chai.assert.isNotOk(span.context().parentId);
        _chai.assert.isOk(span.context().traceId !== 0);
        _chai.assert.isOk(span.context().isSampled());
        _chai.assert.isOk(span.context().isDebug());

        var tagFound = false;
        for (var i = 0; i < span._tags.length; i++) {
            var tag = span._tags[i];
            if (tag.key === constants.JAEGER_DEBUG_HEADER && span._tags[i].value === 'value1') {
                tagFound = true;
            }
        }

        _chai.assert.isOk(tagFound);

        // metrics
        _chai.assert.isOk(_backend2.default.counterEquals(metrics.tracesStartedSampled, 1));
    });
}); // Copyright (c) 2016 Uber Technologies, Inc.
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
//# sourceMappingURL=text_map_codec.js.map
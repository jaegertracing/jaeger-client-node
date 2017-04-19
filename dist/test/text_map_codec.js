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
//# sourceMappingURL=text_map_codec.js.map
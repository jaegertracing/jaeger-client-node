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

var _span_context = require('../src/span_context.js');

var _span_context2 = _interopRequireDefault(_span_context);

var _zipkin_b3_text_map_codec = require('../src/propagators/zipkin_b3_text_map_codec.js');

var _zipkin_b3_text_map_codec2 = _interopRequireDefault(_zipkin_b3_text_map_codec);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

describe('Zipkin B3 Text Map Codec should', function () {

    var tracer = void 0,
        codec = void 0,
        metrics = void 0;

    beforeEach(function () {
        metrics = new _metrics2.default(new _metric_factory2.default());
        tracer = new _tracer2.default('test-tracer', new _in_memory_reporter2.default(), new _const_sampler2.default(false), {
            metrics: metrics
        });

        codec = new _zipkin_b3_text_map_codec2.default({
            urlEncoding: true,
            metrics: metrics
        });

        tracer.registerInjector(_opentracing2.default.FORMAT_HTTP_HEADERS, codec);
        tracer.registerExtractor(_opentracing2.default.FORMAT_HTTP_HEADERS, codec);
    });

    afterEach(function () {
        tracer.close();
    });

    it('report a metric when failing to decode tracer state', function () {
        var headers = {
            'x-b3-traceid': 'zzz-bad-value'
        };

        var context = tracer.extract(_opentracing2.default.FORMAT_HTTP_HEADERS, headers);

        _chai.assert.isOk(context);
        _chai.assert.isOk(_backend2.default.counterEquals(metrics.decodingErrors, 1));
    });

    it('set debug flag when debug-id-header is received', function () {
        var headers = {};
        headers[constants.JAEGER_DEBUG_HEADER] = encodeURIComponent('value1');

        var context = tracer.extract(_opentracing2.default.FORMAT_HTTP_HEADERS, headers);
        _chai.assert.equal(context.debugId, 'value1');
    });

    it('return a context devoid of trace/span ids if invalid ids are encountered in the headers', function () {

        var testCases = [{
            'x-b3-traceid': 'zzzzzz',
            'x-b3-spanid': '123abc',
            'x-b3-parentspanid': '456def'
        }, {
            'x-b3-traceid': '123abc',
            'x-b3-spanid': 'zzzzzz',
            'x-b3-parentspanid': '456def'
        }, {
            'x-b3-traceid': '123abc',
            'x-b3-spanid': '456def',
            'x-b3-parentspanid': 'zzzzz'
        }];

        testCases.forEach(function (testCase) {
            var context = tracer.extract(_opentracing2.default.FORMAT_HTTP_HEADERS, testCase);

            _chai.assert.isOk(context);
            _chai.assert.isNotOk(context.spanIdStr);
            _chai.assert.isNotOk(context.traceIdStr);
            _chai.assert.isNotOk(context.parentIdStr);
        });
    });

    it('set the sampled flag when the zipkin sampled header is received', function () {
        var headers = {
            'x-b3-sampled': '1'
        };

        var context = tracer.extract(_opentracing2.default.FORMAT_HTTP_HEADERS, headers);
        _chai.assert.isOk(context.isSampled());
        _chai.assert.isNotOk(context.isDebug());
    });

    it('set the debug and sampled flags when the zipkin flags header is received', function () {
        var headers = {
            'x-b3-flags': '1'
        };

        var context = tracer.extract(_opentracing2.default.FORMAT_HTTP_HEADERS, headers);
        _chai.assert.isOk(context.isSampled());
        _chai.assert.isOk(context.isDebug());

        headers = {
            'x-b3-flags': '0'
        };

        context = tracer.extract(_opentracing2.default.FORMAT_HTTP_HEADERS, headers);
        _chai.assert.isNotOk(context.isSampled());
        _chai.assert.isNotOk(context.isDebug());
    });

    it('should set the sampled header to "0" if not sampling', function () {
        var headers = {};

        var ctx = _span_context2.default.withStringIds('some-trace', 'some-span', 'some-parent');
        codec.inject(ctx, headers);

        _chai.assert.isUndefined(headers['x-b3-flags']);
        _chai.assert.equal(headers['x-b3-sampled'], '0');
    });

    it('should set the sampled header to "1" if sampling', function () {
        var headers = {};

        var ctx = _span_context2.default.withStringIds('a', 'b', 'c');
        ctx.flags = constants.SAMPLED_MASK;

        codec.inject(ctx, headers);

        _chai.assert.isUndefined(headers['x-b3-flags']);
        _chai.assert.equal(headers['x-b3-sampled'], '1');
    });

    it('should not send the sampled header if debug', function () {
        var headers = {};

        var ctx = _span_context2.default.withStringIds('some-trace', 'some-span', 'some-parent');
        ctx.flags = constants.DEBUG_MASK;

        codec.inject(ctx, headers);

        _chai.assert.equal(headers['x-b3-flags'], '1');
        // > Since Debug implies Sampled, so don't also send "X-B3-Sampled: 1"
        // https://github.com/openzipkin/b3-propagation
        _chai.assert.isUndefined(headers['x-b3-sampled']);
    });

    it('supports the use of the baggage headers', function () {
        var headers = {};
        headers[constants.TRACER_BAGGAGE_HEADER_PREFIX + 'a-key'] = 'a-value';
        headers[constants.JAEGER_BAGGAGE_HEADER] = 'some-key=some-value, another-key=another-value';

        var context = tracer.extract(_opentracing2.default.FORMAT_HTTP_HEADERS, headers);
        _chai.assert.equal(context.baggage['a-key'], 'a-value');
        _chai.assert.equal(context.baggage['some-key'], 'some-value');
        _chai.assert.equal(context.baggage['another-key'], 'another-value');
    });
}); // Copyright (c) 2017 The Jaeger Authors
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
//# sourceMappingURL=zipkin_b3_text_map_codec.js.map
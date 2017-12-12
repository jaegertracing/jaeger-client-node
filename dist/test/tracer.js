'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _chai = require('chai');

var _const_sampler = require('../src/samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _constants = require('../src/constants.js');

var constants = _interopRequireWildcard(_constants);

var _in_memory_reporter = require('../src/reporters/in_memory_reporter.js');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _opentracing = require('opentracing');

var opentracing = _interopRequireWildcard(_opentracing);

var _span_context = require('../src/span_context.js');

var _span_context2 = _interopRequireDefault(_span_context);

var _tracer = require('../src/tracer.js');

var _tracer2 = _interopRequireDefault(_tracer);

var _util = require('../src/util.js');

var _util2 = _interopRequireDefault(_util);

var _metrics = require('../src/metrics/metrics.js');

var _metrics2 = _interopRequireDefault(_metrics);

var _metric_factory = require('./lib/metrics/local/metric_factory.js');

var _metric_factory2 = _interopRequireDefault(_metric_factory);

var _backend = require('./lib/metrics/local/backend.js');

var _backend2 = _interopRequireDefault(_backend);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('tracer should', function () {
    var tracer = void 0;
    var reporter = new _in_memory_reporter2.default();

    beforeEach(function () {
        tracer = new _tracer2.default('test-service-name', reporter, new _const_sampler2.default(true));
    });

    afterEach(function () {
        reporter.clear();
        tracer.close();
    });

    it('begin a new span given only baggage headers', function () {
        // Users sometimes want to pass baggage even if there is no span.
        // In this case we must ensure a new root span is created.
        var headers = {};
        // combine normal baggage encoding
        headers[constants.TRACER_BAGGAGE_HEADER_PREFIX + 'robot'] = 'Bender';
        // with custom encoding via `jaeger-baggage` header
        headers[constants.JAEGER_BAGGAGE_HEADER] = 'male=Fry, female=Leela, Lord Nibbler';
        var spanContext = tracer.extract(opentracing.FORMAT_TEXT_MAP, headers);
        var rootSpan = tracer.startSpan('fry', { childOf: spanContext });

        _chai.assert.isOk(rootSpan.context().traceId);
        _chai.assert.isNotOk(rootSpan.context().parentId);
        _chai.assert.equal(rootSpan.context().flags, 1);
        _chai.assert.equal('Bender', rootSpan.getBaggageItem('robot'));
        _chai.assert.equal('Leela', rootSpan.getBaggageItem('female'));
        _chai.assert.equal('Fry', rootSpan.getBaggageItem('male'));
    });

    it('create a span correctly through _startInternalSpan', function () {
        var traceId = _util2.default.encodeInt64(1);
        var spanId = _util2.default.encodeInt64(2);
        var parentId = _util2.default.encodeInt64(3);
        var flags = 1;
        var context = _span_context2.default.withBinaryIds(traceId, spanId, parentId, flags);
        var start = 123.456;
        var rpcServer = false;
        var internalTags = [];
        var references = [];
        var tags = {
            'keyOne': 'leela',
            'keyTwo': 'bender'
        };
        var span = tracer._startInternalSpan(context, 'op-name', start, internalTags, tags, null, rpcServer, references);

        _chai.assert.deepEqual(span.context().traceId, traceId);
        _chai.assert.deepEqual(span.context().spanId, spanId);
        _chai.assert.deepEqual(span.context().parentId, parentId);
        _chai.assert.equal(span.context().flags, flags);
        _chai.assert.equal(span._startTime, start);
        _chai.assert.equal(Object.keys(span._tags).length, 2);
    });

    it('report a span with no tracer level tags', function () {
        var span = tracer.startSpan('op-name');
        tracer._report(span);
        _chai.assert.isOk(reporter.spans.length, 1);
        var actualTags = _lodash2.default.sortBy(span._tags, function (o) {
            return o.key;
        });

        _chai.assert.equal(2, actualTags.length);
        _chai.assert.equal(actualTags[0].key, 'sampler.param');
        _chai.assert.equal(actualTags[1].key, 'sampler.type');
        _chai.assert.equal(actualTags[0].value, true);
        _chai.assert.equal(actualTags[1].value, 'const');
    });

    it('start a root span with proper structure', function () {
        var startTime = new Date(2016, 8, 18).getTime();
        var span = tracer.startSpan('test-name', {
            startTime: startTime
        });

        _chai.assert.equal(span.context().traceId, span.context().spanId);
        _chai.assert.isNotOk(span.context().parentId);
        _chai.assert.isOk(span.context().isSampled());
        _chai.assert.equal(span._startTime, startTime);
    });

    it('start a child span represented as a separate span from parent, using childOf and references', function () {
        var traceId = _util2.default.encodeInt64(1);
        var spanId = _util2.default.encodeInt64(2);
        var parentId = _util2.default.encodeInt64(3);
        var flags = 1;
        var context = _span_context2.default.withBinaryIds(traceId, spanId, parentId, flags);
        var startTime = 123.456;

        var childOfParams = {
            operationName: 'test-name',
            childOf: context,
            startTime: startTime
        };

        var referenceParams = {
            operationName: 'test-name',
            startTime: startTime,
            references: [new opentracing.Reference(opentracing.REFERENCE_CHILD_OF, context)]
        };

        var assertByStartSpanParameters = function assertByStartSpanParameters(params) {
            var span = tracer.startSpan('test-span', params);
            _chai.assert.deepEqual(span.context().traceId, traceId);
            _chai.assert.deepEqual(span.context().parentId, spanId);
            _chai.assert.equal(span.context().flags, constants.SAMPLED_MASK);
            _chai.assert.equal(span._startTime, startTime);
        };

        assertByStartSpanParameters(childOfParams);
        assertByStartSpanParameters(referenceParams);
    });

    it('inject plain text headers into carrier, and extract span context with the same value', function () {
        var keyOne = 'keyOne';
        var keyTwo = 'keyTwo';
        var baggage = {
            keyOne: 'leela',
            keyTwo: 'bender'
        };
        var savedContext = _span_context2.default.withBinaryIds(_util2.default.encodeInt64(1), _util2.default.encodeInt64(2), _util2.default.encodeInt64(3), constants.SAMPLED_MASK, baggage);

        var assertByFormat = function assertByFormat(format) {
            var carrier = {};
            tracer.inject(savedContext, format, carrier);
            var extractedContext = tracer.extract(format, carrier);

            _chai.assert.deepEqual(savedContext.traceId, extractedContext.traceId);
            _chai.assert.deepEqual(savedContext.spanId, extractedContext.spanId);
            _chai.assert.deepEqual(savedContext.parentId, extractedContext.parentId);
            _chai.assert.equal(savedContext.flags, extractedContext.flags);
            _chai.assert.equal(savedContext.baggage[keyOne], extractedContext.baggage[keyOne]);
            _chai.assert.equal(savedContext.baggage[keyTwo], extractedContext.baggage[keyTwo]);
        };

        assertByFormat(opentracing.FORMAT_TEXT_MAP);
        assertByFormat(opentracing.FORMAT_HTTP_HEADERS);
    });

    it('inject url encoded values into headers', function () {
        var baggage = {
            keyOne: 'Leela vs. Bender'
        };
        var savedContext = _span_context2.default.withBinaryIds(_util2.default.encodeInt64(1), _util2.default.encodeInt64(2), _util2.default.encodeInt64(3), constants.SAMPLED_MASK, baggage);
        var carrier = {};

        tracer.inject(savedContext, opentracing.FORMAT_HTTP_HEADERS, carrier);
        _chai.assert.equal(carrier['uberctx-keyOne'], 'Leela%20vs.%20Bender');
    });

    it('assert inject and extract throw errors when given an invalid format', function () {
        var carrier = {};
        var context = _span_context2.default.withBinaryIds(_util2.default.encodeInt64(1), _util2.default.encodeInt64(2), _util2.default.encodeInt64(3), constants.SAMPLED_MASK);

        // subtle but expect wants a function to call not the result of a function call.
        (0, _chai.expect)(function () {
            tracer.inject(context, 'fake-format', carrier);
        }).to.throw('Unsupported format: fake-format');
        (0, _chai.expect)(function () {
            tracer.extract('fake-format', carrier);
        }).to.throw('Unsupported format: fake-format');
    });

    it('report spans', function () {
        var span = tracer.startSpan('operation');
        tracer._report(span);

        _chai.assert.equal(reporter.spans.length, 1);
    });

    describe('Metrics', function () {
        it('startSpan', function () {
            var params = [{ 'rpcServer': false, 'context': null, 'sampled': true, 'metrics': ['spansStarted', 'spansSampled', 'tracesStartedSampled'] }, { 'rpcServer': true, 'context': '1:2:100:1', 'sampled': true, 'metrics': ['spansStarted', 'spansSampled', 'tracesJoinedSampled'] }, { 'rpcServer': false, 'context': null, 'sampled': false, 'metrics': ['spansStarted', 'spansNotSampled', 'tracesStartedNotSampled'] }, { 'rpcServer': true, 'context': '1:2:100:0', 'sampled': false, 'metrics': ['spansStarted', 'spansNotSampled', 'tracesJoinedNotSampled'] }];

            _lodash2.default.each(params, function (o) {
                var metrics = new _metrics2.default(new _metric_factory2.default());
                tracer = new _tracer2.default('fry', new _in_memory_reporter2.default(), new _const_sampler2.default(o.sampled), {
                    metrics: metrics
                });

                var context = null;
                if (o.context) {
                    context = _span_context2.default.fromString(o.context);
                }

                var tags = {};
                if (o.rpcServer) {
                    tags[opentracing.Tags.SPAN_KIND] = opentracing.Tags.SPAN_KIND_RPC_SERVER;
                }

                tracer.startSpan('bender', {
                    childOf: context,
                    tags: tags
                });

                _lodash2.default.each(o.metrics, function (metricName) {
                    _chai.assert.isOk(_backend2.default.counterEquals(metrics[metricName], 1));
                });
            });
        });

        it('emits counter when report called', function () {
            var metrics = new _metrics2.default(new _metric_factory2.default());
            tracer = new _tracer2.default('fry', new _in_memory_reporter2.default(), new _const_sampler2.default(true), {
                metrics: metrics
            });
            var span = tracer.startSpan('bender');
            tracer._report(span);

            _chai.assert.isOk(_backend2.default.counterEquals(metrics.spansFinished, 1));
        });
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
//# sourceMappingURL=tracer.js.map
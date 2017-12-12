'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _chai = require('chai');

var _const_sampler = require('../src/samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _probabilistic_sampler = require('../src/samplers/probabilistic_sampler');

var _probabilistic_sampler2 = _interopRequireDefault(_probabilistic_sampler);

var _constants = require('../src/constants.js');

var constants = _interopRequireWildcard(_constants);

var _in_memory_reporter = require('../src/reporters/in_memory_reporter.js');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _test_util = require('../src/test_util');

var _test_util2 = _interopRequireDefault(_test_util);

var _mock_logger = require('./lib/mock_logger');

var _mock_logger2 = _interopRequireDefault(_mock_logger);

var _opentracing = require('opentracing');

var opentracing = _interopRequireWildcard(_opentracing);

var _span = require('../src/span.js');

var _span2 = _interopRequireDefault(_span);

var _span_context = require('../src/span_context.js');

var _span_context2 = _interopRequireDefault(_span_context);

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _thrift = require('../src/thrift.js');

var thrift = _interopRequireWildcard(_thrift);

var _tracer = require('../src/tracer.js');

var _tracer2 = _interopRequireDefault(_tracer);

var _util = require('../src/util.js');

var _util2 = _interopRequireDefault(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('span should', function () {
    var reporter = new _in_memory_reporter2.default();
    var tracer = void 0,
        span = void 0,
        spanContext = void 0;

    beforeEach(function () {
        tracer = new _tracer2.default('test-service-name', reporter, new _const_sampler2.default(true), { logger: new _mock_logger2.default() });

        spanContext = _span_context2.default.withBinaryIds(_util2.default.encodeInt64(1), _util2.default.encodeInt64(2), _util2.default.encodeInt64(3), constants.SAMPLED_MASK);

        span = new _span2.default(tracer, 'op-name', spanContext, tracer.now());
    });

    it('return span context when context() is called', function () {
        _chai.assert.equal(span.context(), spanContext);
    });

    it('return tracer when tracer() is called', function () {
        _chai.assert.equal(span.tracer(), tracer);
    });

    it('set operation name correctly', function () {
        span.setOperationName('operation-name');
        _chai.assert.equal(span.operationName, 'operation-name');
    });

    it('finish span with custom duration', function () {
        var initialDate = new Date(2011, 9, 1).getTime();
        span._startTime = initialDate;
        var expectedDuration = 1000;
        var finishDate = initialDate + expectedDuration;

        span.finish(finishDate);

        _chai.assert.equal(span._duration, expectedDuration);
        _chai.assert.equal(reporter.spans.length, 1);
        _chai.assert.equal(reporter.spans[0], span);
    });

    it('finish span twice logs error', function () {
        span.finish();
        span.finish();
        var spanInfo = 'operation=' + span.operationName + ',context=' + span.context().toString();
        _chai.assert.equal(tracer._logger._errorMsgs[0], spanInfo + '#You can only call finish() on a span once.');
    });

    it('set debug and sampling version through sampling priority', function () {
        span._setSamplingPriority(3);

        _chai.assert.isOk(span.context().isDebug());
        _chai.assert.isOk(span.context().isSampled());
    });

    it('unset sampling on span', function () {
        span._setSamplingPriority(0);

        _chai.assert.isNotOk(span.context().isSampled());
    });

    it('add tags', function () {
        var keyValuePairs = {
            numberTag: 7,
            stringTag: 'string',
            booleanTag: true
        };
        span.addTags(keyValuePairs);
        span.addTags({ numberTag: 8 });

        // test to make sure consecutive calls with same key does not
        // overwrite the first key.
        var count = 0;
        for (var i = 0; i < span._tags.length; i++) {
            if (span._tags[i].key === 'numberTag') {
                count += 1;
            }
        }

        _chai.assert.isOk(span._tags.length, 4);
        _chai.assert.equal(count, 2);
    });

    it('add logs with timestamp, and event', function () {
        var timestamp = new Date(2016, 8, 12).getTime();
        var event = 'some messgae';
        span.log({ 'event': event }, timestamp);

        _chai.assert.equal(span._logs.length, 1);
        _chai.assert.equal(span._logs[0].timestamp, timestamp);
        _chai.assert.equal(span._logs[0].fields[0].value, event);
    });

    it('add logs with payload', function () {
        var payload = { a: 1 };
        span.log({ payload: payload });

        _chai.assert.equal(span._logs.length, 1);
        _chai.assert.equal(JSON.stringify(span._logs[0].fields[0].value), JSON.stringify(payload));
    });

    it('add logs with event, but without timestamp', function () {
        var expectedTimestamp = 123.456;
        // mock global clock
        var clock = _sinon2.default.useFakeTimers(expectedTimestamp);
        var event = 'some messgae';
        span.log({ event: event });

        _chai.assert.equal(span._logs.length, 1);
        _chai.assert.equal(span._logs[0].timestamp, expectedTimestamp);
        _chai.assert.equal(span._logs[0].fields[0].value, event);
        clock.restore();
    });

    it('set and retrieve baggage correctly', function () {
        var key = 'some-key';
        var value = 'some-value';

        var spy = _sinon2.default.spy(span._baggageSetter, 'setBaggage');
        span.setBaggageItem(key, value);
        _chai.assert.equal(value, span.getBaggageItem(key));
        (0, _chai.assert)(spy.calledOnce);
        (0, _chai.assert)(spy.calledWith(span, key, value));
    });

    it('inherit baggage from parent', function () {
        var key = 'some-key';
        var value = 'some-value';

        span.setBaggageItem(key, value);
        var child = tracer.startSpan('child', { childOf: span.context() });
        _chai.assert.equal(value, child.getBaggageItem(key));
    });

    it('normalized key correctly', function () {
        var unnormalizedKey = 'SOME_KEY';
        var key = span._normalizeBaggageKey(unnormalizedKey);

        _chai.assert.equal(key, 'some-key');
        _chai.assert.isOk(unnormalizedKey in _span2.default._getBaggageHeaderCache());
    });

    describe('adaptive sampling tests for span', function () {
        var options = [{ desc: 'sampled: ', sampling: true, reportedSpans: 1 }, { desc: 'unsampled: ', sampling: false, reportedSpans: 0 }];
        _lodash2.default.each(options, function (o) {
            it(o.desc + 'should save tags, and logs on an unsampled span incase it later becomes sampled', function () {
                var reporter = new _in_memory_reporter2.default();
                var tracer = new _tracer2.default('test-service-name', reporter, new _const_sampler2.default(false), { logger: new _mock_logger2.default() });
                var span = tracer.startSpan('initially-unsampled-span');
                span.setTag('tagKeyOne', 'tagValueOne');
                span.addTags({
                    'tagKeyTwo': 'tagValueTwo'
                });
                span.log({ 'logkeyOne': 'logValueOne' });

                tracer._sampler = new _const_sampler2.default(o.sampling);
                span.setOperationName('sampled-span');
                span.finish();

                _chai.assert.deepEqual(span._tags[0], { key: 'tagKeyOne', value: 'tagValueOne' });
                _chai.assert.deepEqual(span._tags[1], { key: 'tagKeyTwo', value: 'tagValueTwo' });
                _chai.assert.deepEqual(span._logs[0].fields[0], { key: 'logkeyOne', value: 'logValueOne' });
                _chai.assert.equal(reporter.spans.length, o.reportedSpans);
            });
        });

        describe('span sampling finalizer', function () {
            it('should trigger when it inherits a sampling decision', function () {
                _chai.assert.equal(span.context().samplingFinalized, false, 'Span created in before each is not finalized');

                var childSpan = tracer.startSpan('child-span', { childOf: span });
                _chai.assert.isOk(span.context().samplingFinalized);
                _chai.assert.isOk(childSpan.context().samplingFinalized);
            });

            it('should trigger when it sets the sampling priority', function () {
                // Span created in before each is not finalized.
                _chai.assert.equal(span.context().samplingFinalized, false);

                span.setTag(opentracing.Tags.SAMPLING_PRIORITY, 1);
                _chai.assert.isOk(span.context().samplingFinalized);

                var unsampledSpan = tracer.startSpan('usampled-span');
                unsampledSpan.setTag(opentracing.Tags.SAMPLING_PRIORITY, -1);
                _chai.assert.isOk(unsampledSpan.context().samplingFinalized);
            });

            it('should trigger on a finish()-ed span', function () {
                // Span created in before each is not finalized.
                _chai.assert.equal(span.context().samplingFinalized, false);

                span.finish();
                _chai.assert.isOk(span.context().samplingFinalized);
            });

            it('should trigger after calling setOperationName', function () {
                // Span created in before each is not finalized.
                _chai.assert.equal(span.context().samplingFinalized, false);

                span.setOperationName('fry');
                _chai.assert.isOk(span.context().samplingFinalized);
            });

            it('should trigger when its context is injected into headers', function () {
                // Span created in before each is not finalized.
                _chai.assert.equal(span.context().samplingFinalized, false);

                var headers = {};
                tracer.inject(span.context(), opentracing.FORMAT_HTTP_HEADERS, headers);

                _chai.assert.isOk(span.context().samplingFinalized);
            });
        });

        it('isWriteable returns true if not finalized, or the span is sampled', function () {
            tracer = new _tracer2.default('test-service-name', new _in_memory_reporter2.default(), new _const_sampler2.default(false), { logger: new _mock_logger2.default() });
            var unFinalizedSpan = tracer.startSpan('unFinalizedSpan');
            _chai.assert.equal(unFinalizedSpan.context().samplingFinalized, false);
            _chai.assert.isOk(unFinalizedSpan._isWriteable());

            tracer._sampler = new _const_sampler2.default(true);
            var sampledSpan = tracer.startSpan('sampled-span');

            sampledSpan.finish(); // finalizes the span
            _chai.assert.isOk(sampledSpan.context().samplingFinalized);

            _chai.assert.isOk(sampledSpan._isWriteable());
        });

        it('2nd setOperationName should add sampler tags to span, and change operationName', function () {
            var span = tracer.startSpan('fry');

            _chai.assert.equal(span.operationName, 'fry');
            _chai.assert.isOk(_test_util2.default.hasTags(span, {
                'sampler.type': 'const',
                'sampler.param': true
            }));
            tracer._sampler = new _probabilistic_sampler2.default(1.0);
            span.setOperationName('re-sampled-span');

            _chai.assert.equal(span.operationName, 're-sampled-span');
            _chai.assert.isOk(_test_util2.default.hasTags(span, {
                'sampler.type': 'probabilistic',
                'sampler.param': 1
            }));
        });

        it('2nd setOperationName should not change the sampling tags, but should change the operationName', function () {
            var span = tracer.startSpan('fry');

            span.setOperationName('new-span-one');
            _chai.assert.equal(span.operationName, 'new-span-one');

            // update sampler to something will always sample
            tracer._sampler = new _probabilistic_sampler2.default(1.0);

            // The second cal lshould rename the operation name, but
            // not re-sample the span.  This is because finalize was set 
            // in the first 'setOperationName' call.
            span.setOperationName('new-span-two');

            _chai.assert.equal(span.operationName, 'new-span-two');
            _chai.assert.isOk(_test_util2.default.hasTags(span, {
                'sampler.type': 'const',
                'sampler.param': true
            }));
        });
    });

    describe('setTag', function () {
        it('should set a tag, and return a span', function () {
            var newSpan = span.setTag('key', 'value');
            _chai.assert.isOk(newSpan instanceof _span2.default);
            _chai.assert.isOk(_lodash2.default.isEqual(span._tags[0], { 'key': 'key', 'value': 'value' }));
        });
    });

    // TODO(oibe) need tests for standard tags, and handlers
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
//# sourceMappingURL=span.js.map
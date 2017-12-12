'use strict';

var _chai = require('chai');

var _metrics = require('../../src/metrics/metrics.js');

var _metrics2 = _interopRequireDefault(_metrics);

var _metric_factory = require('../lib/metrics/local/metric_factory.js');

var _metric_factory2 = _interopRequireDefault(_metric_factory);

var _backend = require('../lib/metrics/local/backend.js');

var _backend2 = _interopRequireDefault(_backend);

var _baggage_setter = require('../../src/baggage/baggage_setter.js');

var _baggage_setter2 = _interopRequireDefault(_baggage_setter);

var _tracer = require('../../src/tracer.js');

var _tracer2 = _interopRequireDefault(_tracer);

var _in_memory_reporter = require('../../src/reporters/in_memory_reporter.js');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _const_sampler = require('../../src/samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _default_baggage_restriction_manager = require('../../src/baggage/default_baggage_restriction_manager.js');

var _default_baggage_restriction_manager2 = _interopRequireDefault(_default_baggage_restriction_manager);

var _restriction = require('../../src/baggage/restriction');

var _restriction2 = _interopRequireDefault(_restriction);

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('BaggageSetter should', function () {
    var metrics = void 0;
    var reporter = new _in_memory_reporter2.default();
    var tracer = void 0,
        span = void 0;

    var assertBaggageLogs = function assertBaggageLogs(log, key, value, truncated, override, invalid) {
        var fields = {};
        log.fields.forEach(function (kv) {
            fields[kv.key] = kv.value;
        });
        _chai.assert.equal(fields.event, 'baggage');
        _chai.assert.equal(fields.key, key);
        _chai.assert.equal(fields.value, value);
        if (truncated) {
            _chai.assert.equal(fields.truncated, 'true');
        }
        if (override) {
            _chai.assert.equal(fields.override, 'true');
        }
        if (invalid) {
            _chai.assert.equal(fields.invalid, 'true');
        }
    };

    beforeEach(function () {
        metrics = new _metrics2.default(new _metric_factory2.default());

        tracer = new _tracer2.default('test-service-name', reporter, new _const_sampler2.default(true), {
            metrics: metrics
        });

        span = tracer.startSpan('op-name');
    });

    afterEach(function () {
        tracer.close();
    });

    it('fail for invalid baggage key', function () {
        var mgr = new _default_baggage_restriction_manager2.default();
        _sinon2.default.stub(mgr, 'getRestriction', function (key) {
            return new _restriction2.default(false, 0);
        });
        var setter = new _baggage_setter2.default(mgr, metrics);
        var key = "key";
        var value = "value";
        var spanContext = setter.setBaggage(span, key, value);
        _chai.assert.isUndefined(spanContext._baggage[key]);
        assertBaggageLogs(span._logs[0], key, value, false, false, true);
        _chai.assert.equal(_backend2.default.counterValue(metrics.baggageUpdateFailure), 1);
    });

    it('truncate valid baggage key using maxValueLength', function () {
        var setter = new _baggage_setter2.default(new _default_baggage_restriction_manager2.default(5), metrics);
        var key = "key";
        var value = "0123456789";
        var expected = "01234";
        // Set pre existing baggage to context
        span._spanContext = span.context().withBaggageItem(key, value);

        var spanContext = setter.setBaggage(span, key, value);
        _chai.assert.equal(spanContext._baggage[key], expected);
        assertBaggageLogs(span._logs[0], key, expected, true, true, false);
        _chai.assert.equal(_backend2.default.counterValue(metrics.baggageUpdateSuccess), 1);
        _chai.assert.equal(_backend2.default.counterValue(metrics.baggageTruncate), 1);
    });

    it('not set logs if span is not sampled', function () {
        var mgr = new _default_baggage_restriction_manager2.default();
        tracer = new _tracer2.default('test-service-name', reporter, new _const_sampler2.default(false), {
            metrics: metrics,
            baggageRestrictionManager: mgr
        });
        span = tracer.startSpan('op-name');

        var setter = new _baggage_setter2.default(mgr, metrics);
        var key = "key";
        var value = "0123456789";
        var spanContext = setter.setBaggage(span, key, value);
        _chai.assert.equal(spanContext._baggage[key], value);
        _chai.assert.lengthOf(span._logs, 0);
    });
}); // Copyright (c) 2017 Uber Technologies, Inc.
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
//# sourceMappingURL=baggage_setter.js.map
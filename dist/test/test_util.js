'use strict';

var _chai = require('chai');

var _const_sampler = require('../src/samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _in_memory_reporter = require('../src/reporters/in_memory_reporter.js');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _span_context = require('../src/span_context.js');

var _span_context2 = _interopRequireDefault(_span_context);

var _tracer = require('../src/tracer.js');

var _tracer2 = _interopRequireDefault(_tracer);

var _test_util = require('../src/test_util.js');

var _test_util2 = _interopRequireDefault(_test_util);

var _util = require('../src/util.js');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Copyright (c) 2016 Uber Technologies, Inc.
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

describe('TestUtils', function () {
    var tracer = void 0;
    var span = void 0;
    var spanContext = void 0;

    before(function () {
        tracer = new _tracer2.default('test-tracer', new _in_memory_reporter2.default(), new _const_sampler2.default(true));
    });

    beforeEach(function () {
        span = tracer.startSpan('op-name');
        spanContext = _span_context2.default.fromString('ab:cd:ef:3');
    });

    it('should support hasTags', function () {
        var tags = {
            'keyOne': 'valueOne',
            'keyTwo': 'valueTwo'
        };
        span.addTags(tags);

        _chai.assert.isOk(_test_util2.default.hasTags(span, tags));
        _chai.assert.isNotOk(_test_util2.default.hasTags(span, { 'k': 'v' }));
        _chai.assert.isNotOk(_test_util2.default.hasTags(span, { 'keyOne': 'valueTwo' }));
    });

    it('should support getTags', function () {
        var expectedTags = {
            'keyOne': 'valueOne',
            'keyTwo': 'valueTwo'
        };
        span.addTags(expectedTags);
        var actualTags = _test_util2.default.getTags(span);
        _chai.assert.equal(actualTags['keyOne'], expectedTags['keyOne']);
        _chai.assert.equal(actualTags['keyTwo'], expectedTags['keyTwo']);
        var filteredTags = _test_util2.default.getTags(span, ['keyTwo', 'keyThree']);
        _chai.assert.deepEqual({ 'keyTwo': 'valueTwo' }, filteredTags);
    });
});
//# sourceMappingURL=test_util.js.map
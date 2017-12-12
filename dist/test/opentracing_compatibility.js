'use strict';

var _api_compatibility = require('opentracing/test/api_compatibility.js');

var _api_compatibility2 = _interopRequireDefault(_api_compatibility);

var _chai = require('chai');

var _const_sampler = require('../src/samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _in_memory_reporter = require('../src/reporters/in_memory_reporter.js');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _opentracing = require('opentracing');

var opentracing = _interopRequireWildcard(_opentracing);

var _tracer = require('../src/tracer');

var _tracer2 = _interopRequireDefault(_tracer);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

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

describe('Jaeger Tracer', function () {
    it('is compatible with opentracing', function () {
        (0, _api_compatibility2.default)(function () {
            return new _tracer2.default('test-tracer', new _in_memory_reporter2.default(), new _const_sampler2.default(true));
        }, { 'checkBaggageValues': true });
    });
});
//# sourceMappingURL=opentracing_compatibility.js.map
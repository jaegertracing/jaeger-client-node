'use strict';

var _chai = require('chai');

var _entrypoint = require('../entrypoint');

var _entrypoint2 = _interopRequireDefault(_entrypoint);

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

describe('entrypoint', function () {
    it('should import and create objects without error', function () {
        (0, _chai.expect)(_entrypoint2.default.initTracer).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.ConstSampler).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.ProbabilisticSampler).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.RateLimitingSampler).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.RemoteSampler).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.CompositeReporter).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.InMemoryReporter).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.LoggingReporter).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.NoopReporter).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.RemoteReporter).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.TestUtils).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.SpanContext).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.TChannelBridge).to.be.a('function');
        (0, _chai.expect)(_entrypoint2.default.opentracing).to.be.a('object');
    });
});
//# sourceMappingURL=entrypoint.js.map
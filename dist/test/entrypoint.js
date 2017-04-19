'use strict';

var _chai = require('chai');

var _entrypoint = require('../entrypoint');

var _entrypoint2 = _interopRequireDefault(_entrypoint);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Copyright (c) 2016 Uber Technologies, Inc.
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
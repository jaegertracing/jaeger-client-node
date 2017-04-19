'use strict';

var _chai = require('chai');

var _constants = require('../src/constants.js');

var constants = _interopRequireWildcard(_constants);

var _span_context = require('../src/span_context.js');

var _span_context2 = _interopRequireDefault(_span_context);

var _util = require('../src/util.js');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

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

describe('SpanContext should', function () {
    var LARGEST_64_BUFFER = void 0;
    before(function () {
        LARGEST_64_BUFFER = new Buffer(8);
        LARGEST_64_BUFFER.writeUInt32BE(0xffffffff, 0);
        LARGEST_64_BUFFER.writeUInt32BE(0xffffffff, 4);
    });

    it('return given values as they were set', function () {
        var traceId = _util2.default.encodeInt64(1);
        var spanId = _util2.default.encodeInt64(2);
        var parentId = _util2.default.encodeInt64(3);
        var flags = 1;

        var context = _span_context2.default.withBinaryIds(traceId, spanId, parentId, flags);

        _chai.assert.deepEqual(traceId, context.traceId);
        _chai.assert.deepEqual(spanId, context.spanId);
        _chai.assert.deepEqual(parentId, context.parentId);
        _chai.assert.equal(flags, context.flags);
    });

    it('return IsSampled properly', function () {
        var context = _span_context2.default.withBinaryIds(_util2.default.encodeInt64(1), _util2.default.encodeInt64(2), _util2.default.encodeInt64(3), 3);
        _chai.assert.isOk(context.isSampled());
        _chai.assert.isOk(context.isDebug());

        context._flags = 0;
        _chai.assert.isNotOk(context.isSampled());
        _chai.assert.isNotOk(context.isDebug());
    });

    it('format strings properly with toString', function () {
        var ctx1 = _span_context2.default.withBinaryIds(_util2.default.encodeInt64(0x100), _util2.default.encodeInt64(0x7f), null, 1);
        _chai.assert.equal(ctx1.toString(), '100:7f:0:1');

        var ctx2 = _span_context2.default.withBinaryIds(_util2.default.encodeInt64(255 << 4), _util2.default.encodeInt64(127), _util2.default.encodeInt64(256), 0);
        _chai.assert.equal(ctx2.toString(), 'ff0:7f:100:0');

        // test large numbers
        var ctx3 = _span_context2.default.withBinaryIds(LARGEST_64_BUFFER, LARGEST_64_BUFFER, LARGEST_64_BUFFER, 0);
        _chai.assert.equal(ctx3.toString(), 'ffffffffffffffff:ffffffffffffffff:ffffffffffffffff:0');
        _chai.assert.equal('ffffffffffffffff', ctx3.traceIdStr);
        _chai.assert.equal('ffffffffffffffff', ctx3.spanIdStr);
        _chai.assert.equal('ffffffffffffffff', ctx3.parentIdStr);
    });

    it('turn properly formatted strings into correct span contexts', function () {
        var context = _span_context2.default.fromString('100:7f:0:1');

        _chai.assert.deepEqual('100', context.traceIdStr);
        _chai.assert.deepEqual(_util2.default.encodeInt64(0x7f), context.spanId);
        _chai.assert.equal(null, context.parentId);
        _chai.assert.equal(1, context.flags);

        // test large numbers
        context = _span_context2.default.fromString('ffffffffffffffff:ffffffffffffffff:5:1');
        _chai.assert.equal('ffffffffffffffff', context.traceIdStr);
        _chai.assert.equal('ffffffffffffffff', context.spanIdStr);
        _chai.assert.deepEqual(LARGEST_64_BUFFER, context.spanId);
        _chai.assert.deepEqual(LARGEST_64_BUFFER, context.spanId);
        _chai.assert.deepEqual(_util2.default.encodeInt64(0x5), context.parentId);
        _chai.assert.equal(context.flags, 0x1);
    });

    it('return null on malformed traces', function () {
        _chai.assert.equal(_span_context2.default.fromString('bad value'), null);
        _chai.assert.equal(_span_context2.default.fromString('1:1:1:1:1'), null, 'Too many colons');
        _chai.assert.equal(_span_context2.default.fromString('1:1:1'), null, 'Too few colons');
        _chai.assert.equal(_span_context2.default.fromString('x:1:1:1'), null, 'Not all numbers');
        _chai.assert.equal(_span_context2.default.fromString('1:x:1:1'), null, 'Not all numbers');
        _chai.assert.equal(_span_context2.default.fromString('1:1:x:1'), null, 'Not all numbers');
        _chai.assert.equal(_span_context2.default.fromString('1:1:1:x'), null, 'Not all numbers');
        _chai.assert.equal(_span_context2.default.fromString('0:1:1:1'), null, 'Trace ID cannot be zero');
    });
});
//# sourceMappingURL=span_context.js.map
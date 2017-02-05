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

import {assert} from 'chai';
import * as constants from '../src/constants.js';
import SpanContext from '../src/span_context.js';
import Utils from '../src/util.js';

describe ('SpanContext should', () => {
    let LARGEST_64_BUFFER;
    before (() => {
        LARGEST_64_BUFFER = new Buffer(8);
        LARGEST_64_BUFFER.writeUInt32BE(0xffffffff, 0);
        LARGEST_64_BUFFER.writeUInt32BE(0xffffffff, 4);
    });

    it ('return given values as they were set', () => {
        let traceId = Utils.encodeInt64(1);
        let spanId = Utils.encodeInt64(2);
        let parentId = Utils.encodeInt64(3);
        let flags = 1;

        let context = SpanContext.withBinaryIds(traceId, spanId, parentId, flags);

        assert.deepEqual(traceId, context.traceId);
        assert.deepEqual(spanId, context.spanId);
        assert.deepEqual(parentId, context.parentId);
        assert.equal(flags, context.flags);
    });

    it ('return IsSampled properly', () => {
        let context = SpanContext.withBinaryIds(
                Utils.encodeInt64(1),
                Utils.encodeInt64(2),
                Utils.encodeInt64(3),
                3
            );
        assert.isOk(context.isSampled());
        assert.isOk(context.isDebug());

        context._flags = 0;
        assert.isNotOk(context.isSampled());
        assert.isNotOk(context.isDebug());
    });

    it ('format strings properly with toString', () => {
        let ctx1 = SpanContext.withBinaryIds(Utils.encodeInt64(0x100), Utils.encodeInt64(0x7f), null, 1);
        assert.equal(ctx1.toString(), '100:7f:0:1');

        let ctx2 = SpanContext.withBinaryIds(Utils.encodeInt64(255 << 4), Utils.encodeInt64(127), Utils.encodeInt64(256), 0);
        assert.equal(ctx2.toString(), 'ff0:7f:100:0');

        // test large numbers
        let ctx3 = SpanContext.withBinaryIds(
            LARGEST_64_BUFFER,
            LARGEST_64_BUFFER,
            LARGEST_64_BUFFER,
            0);
        assert.equal(ctx3.toString(), 'ffffffffffffffff:ffffffffffffffff:ffffffffffffffff:0');
        assert.equal('ffffffffffffffff', ctx3.traceIdStr);
        assert.equal('ffffffffffffffff', ctx3.spanIdStr);
        assert.equal('ffffffffffffffff', ctx3.parentIdStr);
    });

    it ('turn properly formatted strings into correct span contexts', () => {
        let context = SpanContext.fromString('100:7f:0:1');

        assert.deepEqual('100', context.traceIdStr);
        assert.deepEqual(Utils.encodeInt64(0x7f), context.spanId);
        assert.equal(null, context.parentId);
        assert.equal(1, context.flags);

        // test large numbers
        context = SpanContext.fromString('ffffffffffffffff:ffffffffffffffff:5:1');
        assert.equal('ffffffffffffffff', context.traceIdStr);
        assert.equal('ffffffffffffffff', context.spanIdStr);
        assert.deepEqual(LARGEST_64_BUFFER, context.spanId);
        assert.deepEqual(LARGEST_64_BUFFER, context.spanId);
        assert.deepEqual(Utils.encodeInt64(0x5), context.parentId);
        assert.equal(context.flags, 0x1);
    });

    it ('return null on malformed traces', () => {
        assert.equal(SpanContext.fromString('bad value'), null);
        assert.equal(SpanContext.fromString('1:1:1:1:1'), null, 'Too many colons');
        assert.equal(SpanContext.fromString('1:1:1'), null, 'Too few colons');
        assert.equal(SpanContext.fromString('x:1:1:1'), null, 'Not all numbers');
        assert.equal(SpanContext.fromString('1:x:1:1'), null, 'Not all numbers');
        assert.equal(SpanContext.fromString('1:1:x:1'), null, 'Not all numbers');
        assert.equal(SpanContext.fromString('1:1:1:x'),  null, 'Not all numbers');
        assert.equal(SpanContext.fromString('0:1:1:1'), null, 'Trace ID cannot be zero');
    });
});

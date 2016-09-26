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
    let LARGEST_64;
    before (() => {
        LARGEST_64 = Utils.encodeInt64(0xffffffff, 0xffffffff);
    });

    it ('return given values as they were set', () => {
        let traceId = Utils.getRandom64();
        let spanId = Utils.getRandom64();
        let parentId = Utils.getRandom64();
        let flags = 1;

        let context = new SpanContext(traceId, spanId, parentId, flags);

        assert.isOk(traceId.equals(context.traceId));
        assert.isOk(spanId.equals(context.spanId));
        assert.equal(parentId, context.parentId);
        assert.equal(flags, context.flags);
    });

    it ('return IsSampled properly', () => {
        let context = new SpanContext(
                Utils.getRandom64(),
                Utils.getRandom64(),
                Utils.getRandom64(),
                3
            );
        assert.isOk(context.isSampled());
        assert.isOk(context.isDebug());

        context._flags = 0;
        assert.isNotOk(context.isSampled());
        assert.isNotOk(context.isDebug());
    });

    it ('format strings properly with toString', () => {
        let ctx1 = new SpanContext(Utils.encodeInt64(0x100), Utils.encodeInt64(0x7f), null, 1).toString();
        assert.equal(ctx1, '100:7f:0:1');

        let ctx2 = new SpanContext(Utils.encodeInt64(255 << 4), Utils.encodeInt64(127), Utils.encodeInt64(256), 0).toString();
        assert.equal(ctx2, 'ff0:7f:100:0');

        // test large numbers
        let ctx3 = new SpanContext(
            LARGEST_64,
            LARGEST_64,
            LARGEST_64,
            0).toString();
        assert.equal(ctx3, 'ffffffffffffffff:ffffffffffffffff:ffffffffffffffff:0');
    });

    it ('turn properly formatted strings into correct span contexts', () => {
        let context = SpanContext.fromString('100:7f:0:1');

        assert.isOk(Utils.encodeInt64(0x100).equals(context.traceId));
        assert.isOk(Utils.encodeInt64(Utils.encodeInt64(0x7f), context.spanId));
        assert.equal(null, context.parentId);
        assert.equal(1, context.flags);

        // test large numbers
        context = SpanContext.fromString('ffffffffffffffff:ffffffffffffffff:5:1');
        assert.isOk(LARGEST_64.equals(context.spanId));
        assert.isOk(Utils.encodeInt64(0x5).equals(context.parentId));
        assert.equal(context.flags, constants.SAMPLED_MASK);
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

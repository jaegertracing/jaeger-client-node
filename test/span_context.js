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

import { assert } from 'chai';
import SpanContext from '../src/span_context';
import Utils from '../src/util';

describe('SpanContext', () => {
  let LARGEST_64_BUFFER;
  before(() => {
    LARGEST_64_BUFFER = new Buffer(8);
    LARGEST_64_BUFFER.writeUInt32BE(0xffffffff, 0);
    LARGEST_64_BUFFER.writeUInt32BE(0xffffffff, 4);
  });

  it('should initialize parent to null', () => {
    let ctx = SpanContext.constructor();
    assert.equal(null, ctx.parentId);
  });

  it('should return given values as they were set', () => {
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

  it('should return given values as they were set 128 bit', () => {
    let traceId = Buffer.concat([Utils.encodeInt64(2), Utils.encodeInt64(1)]);
    let spanId = Utils.encodeInt64(3);
    let parentId = Utils.encodeInt64(4);
    let flags = 1;

    let context = SpanContext.withBinaryIds(traceId, spanId, parentId, flags);

    assert.deepEqual(traceId, context.traceId);
    assert.deepEqual('00000000000000020000000000000001', context.traceIdStr);
    assert.deepEqual(spanId, context.spanId);
    assert.deepEqual(parentId, context.parentId);
    assert.equal(flags, context.flags);
  });

  it('should expose IsSampled properly', () => {
    let context = SpanContext.withBinaryIds(
      Utils.encodeInt64(1),
      Utils.encodeInt64(2),
      Utils.encodeInt64(3),
      3
    );
    assert.isTrue(context.isSampled());
    assert.isTrue(context.isDebug());

    context.flags = 0;
    assert.isFalse(context.isSampled());
    assert.isFalse(context.isDebug());
  });

  it('should format strings properly with toString', () => {
    let ctx1 = SpanContext.withBinaryIds(Utils.encodeInt64(0x100), Utils.encodeInt64(0x7f), null, 1);
    assert.equal(ctx1.toString(), '0000000000000100:000000000000007f:0:1');

    let ctx2 = SpanContext.withBinaryIds(
      Utils.encodeInt64(255 << 4),
      Utils.encodeInt64(127),
      Utils.encodeInt64(256),
      0
    );
    assert.equal(ctx2.toString(), '0000000000000ff0:000000000000007f:0000000000000100:0');

    // test large numbers
    let ctx3 = SpanContext.withBinaryIds(LARGEST_64_BUFFER, LARGEST_64_BUFFER, LARGEST_64_BUFFER, 0);
    assert.equal(ctx3.toString(), 'ffffffffffffffff:ffffffffffffffff:ffffffffffffffff:0');
    assert.equal('ffffffffffffffff', ctx3.traceIdStr);
    assert.equal('ffffffffffffffff', ctx3.spanIdStr);
    assert.equal('ffffffffffffffff', ctx3.parentIdStr);
  });

  it('should turn properly formatted strings into correct span contexts', () => {
    let context = SpanContext.fromString('100:7f:0:1');

    assert.deepEqual('0000000000000100', context.traceIdStr);
    assert.deepEqual(Utils.encodeInt64(0x100), context.traceId);
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

  it('should turn properly formatted strings into correct span contexts 128 bit', () => {
    let context = SpanContext.fromString('20000000000000100:7f:0:1');

    assert.deepEqual('00000000000000020000000000000100', context.traceIdStr);
    assert.deepEqual(Buffer.concat([Utils.encodeInt64(0x2), Utils.encodeInt64(0x100)]), context.traceId);
    assert.deepEqual(Utils.encodeInt64(0x7f), context.spanId);
    assert.equal(null, context.parentId);
    assert.equal(1, context.flags);

    // test large numbers
    context = SpanContext.fromString('ffffffffffffffffffffffffffffffff:ffffffffffffffff:5:1');
    assert.equal('ffffffffffffffffffffffffffffffff', context.traceIdStr);
    assert.equal('ffffffffffffffff', context.spanIdStr);
    assert.deepEqual(Buffer.concat([LARGEST_64_BUFFER, LARGEST_64_BUFFER]), context.traceId);
    assert.deepEqual(LARGEST_64_BUFFER, context.spanId);
    assert.deepEqual(Utils.encodeInt64(0x5), context.parentId);
    assert.equal(context.flags, 0x1);
  });

  it('should parse string ids with stripped leading zero', () => {
    const ctx = SpanContext.withStringIds('ff0', '7f', '100', 0);

    assert.equal(ctx.toString(), '0000000000000ff0:000000000000007f:0000000000000100:0');
  });

  it('should return null on malformed traces', () => {
    assert.equal(SpanContext.fromString('bad value'), null);
    assert.equal(SpanContext.fromString('1:1:1:1:1'), null, 'Too many colons');
    assert.equal(SpanContext.fromString('1:1:1'), null, 'Too few colons');
    assert.equal(SpanContext.fromString('x:1:1:1'), null, 'Not all numbers');
    assert.equal(SpanContext.fromString('1:x:1:1'), null, 'Not all numbers');
    assert.equal(SpanContext.fromString('1:1:x:1'), null, 'Not all numbers');
    assert.equal(SpanContext.fromString('1:1:1:x'), null, 'Not all numbers');
    assert.equal(SpanContext.fromString('0:1:1:1'), null, 'Trace ID cannot be zero');
  });

  it('should allow access to firehose mode', () => {
    let context = SpanContext.fromString('100:7f:0:1');
    assert.isFalse(context.isFirehose());
    context._setFirehose(true);
    assert.isTrue(context.isFirehose());
    context._setFirehose(false);
    assert.isFalse(context.isFirehose());
  });

  it('should return span and trace id as strings', () => {
    const context = SpanContext.fromString('ffffffffffffffffffffffffffffffff:ffffffffffffffff:5:1');;
    assert.equal(context.toTraceId(), 'ffffffffffffffffffffffffffffffff');
    assert.equal(context.toSpanId(), 'ffffffffffffffff');
  });
});

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

namespace java com.uber.jaeger.thriftjava

// TODO(oibe) remove this file, also thriftify does not support unions

// TagValue is a union of different types representing a strongly typed value of a tag.
// TODO: in Go all these fields become pointers, causing lots unnecessary memory allocs,
// so we may want to revisit and maybe just use a byte array with enum directly in Tag.
struct TagValue {
  1: optional string vStr
  2: optional double vDouble
  3: optional bool   vBool
  4: optional i16    vInt16
  5: optional i32    vInt32
  6: optional i64    vInt64
  7: optional binary vBinary
}

// Tag is a basic strongly typed key/value pair.
struct Tag {
  1: required string   key
  2: required TagValue value
}


// Log is a timed even with an arbitrary set of tags.
struct Log {
  1: required i64       timestamp
  2: required list<Tag> tags
}

enum SpanRefType { CHILD_OF, FOLLOWS_FROM }

// SpanRef describes causal relationship of the current span to another span (e.g. 'child-of')
struct SpanRef {
  1: required SpanRefType ref_type
  2: required i64         trace_id
  3: required i64         span_id
}

// Span represents a named unit of work performed by a service.
struct Span {
  1: required i64           trace_id      // unique trace id, the same for all spans in the trace
  2: required i64           span_id       // unique span id (only unique within a given trace)
  3: required string        operationName
  4: optional list<SpanRef> references    // causal references to other spans
  5: required i32           flags         // tbd
  6: required i64           timestamp
  7: required i64           duration
  8: optional list<Tag>     tags
  9: optional list<Log>     logs
}

// Process describes the traced process/service that emits spans.
struct Process {
  1: required string    serviceName
  2: optional list<Tag> tags
}

// Batch is a collection of spans reported out of process.
struct Batch {
  1: required Process    process
  2: required list<Span> spans
}

service Agent {
    oneway void emitZipkinBatch(1: list<Span> spans)
}

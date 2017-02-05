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
import deepEqual from 'deep-equal';
import ConstSampler from '../src/samplers/const_sampler.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import Tracer from '../src/tracer.js';
import ThriftUtils from '../src/thrift.js';
import Utils from '../src/util.js';

describe ('ThriftUtils', () => {
    it ('should exercise all paths in getTagType', () => {
        let tags = ThriftUtils.getThriftTags([
            {'key': 'double', 'value': 1.0 },
            {'key': 'boolean', 'value': true },
            {'key': 'binary', 'value': new Buffer(1) },
            {'key': 'string', 'value': 'some-string' },
            {'key': 'object', 'value': { x: 'y' } }
        ]);

        assert.equal(tags[0].vType, 'DOUBLE');
        assert.equal(tags[1].vType, 'BOOL');
        assert.equal(tags[2].vType, 'BINARY');
        assert.equal(tags[3].vType, 'STRING');
        assert.equal(tags[4].vType, 'STRING');
    });

    it ('should initialize emptyBuffer to all zeros', () => {
        let buf = new Buffer(8);
        buf.fill(0);

        assert.isOk(deepEqual(ThriftUtils.emptyBuffer, buf));
    });

    it ('should convert timestamps to microseconds', () => {
        let reporter = new InMemoryReporter();
        let tracer = new Tracer(
            'test-service-name',
            reporter,
            new ConstSampler(true)
        );
        let span = tracer.startSpan('some operation', { startTime: 123.456 });
        span.log({ event: 'some log' }, 123.567);
        span.finish(123.678);
        tracer.close();
        let tSpan = ThriftUtils.spanToThrift(span);
        assert.deepEqual(tSpan.startTime, Utils.encodeInt64(123456));
        assert.deepEqual(tSpan.duration, Utils.encodeInt64((123.678-123.456) * 1000));
        assert.deepEqual(tSpan.logs[0].timestamp, Utils.encodeInt64(123567));
    });
});

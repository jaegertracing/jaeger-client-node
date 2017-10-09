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

import {assert} from 'chai';
import ConstSampler from '../src/samplers/const_sampler.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import Tracer from '../src/tracer.js';
import ThriftUtils from '../src/thrift.js';
import Utils from '../src/util.js';

describe ('ThriftUtils', () => {
    it ('should exercise all paths in getTagType', () => {
        let blob = new Buffer(1);
        let testCases = [
            {'key': 'double', 'value': 1.0, vType: 'DOUBLE', vDouble: 1.0 },
            {'key': 'boolean', 'value': true, vType: 'BOOL', vBool: true },
            {'key': 'binary', 'value': blob, vType: 'BINARY', vBinary: blob },
            {'key': 'string', 'value': 'some-string', vType: 'STRING', vStr: 'some-string' },
            {'key': 'object', 'value': { x: 'y' }, vType: 'STRING', vStr: `{"x":"y"}` },
            {'key': 'func', 'value': function f(){}, vType: 'STRING', vStr: `function f() {}` }
        ];

        testCases.forEach(testCase => {
            let tag = {'key': testCase['key'], 'value': testCase['value']};
            let actualTag = ThriftUtils.getThriftTags([tag])[0];
            let expectedTag = {
                key: testCase.key,
                vType: testCase.vType,
                vStr: testCase.vStr === undefined ? '' : testCase.vStr,
                vDouble: testCase.vDouble === undefined ? 0 : testCase.vDouble,
                vBool: testCase.vBool === undefined ? false : testCase.vBool,
                vLong: testCase.vLong === undefined ? ThriftUtils.emptyBuffer : testCase.vLong,
                vBinary: testCase.vBinary === undefined ? ThriftUtils.emptyBuffer : testCase.vBinary
            }
            assert.deepEqual(actualTag, expectedTag);
        });
    });

    it ('should initialize emptyBuffer to all zeros', () => {
        let buf = new Buffer(8);
        buf.fill(0);

        assert.deepEqual(ThriftUtils.emptyBuffer, buf);
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

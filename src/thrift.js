// @flow
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

import fs from 'fs';
import Long from 'long';
import path from 'path';
import {Thrift} from 'thriftrw';
import Utils from './util.js';

export default class ThriftUtils {
    static _thrift = new Thrift({
        source: fs.readFileSync(path.join(__dirname, './jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
        allowOptionalArguments: true
    });
    static emptyBuffer: Buffer =new Buffer([0, 0 , 0, 0, 0, 0, 0, 0]);

    static getThriftTags(initialTags: Array<Tag>): Array<any> {
        let thriftTags = [];
        for (let i = 0; i < initialTags.length; i++) {
            let tag = initialTags[i];

            let key: string = tag.key;

            let vLong: Buffer = ThriftUtils.emptyBuffer;
            let vBinary: Buffer = ThriftUtils.emptyBuffer;
            let vBool: boolean = false;
            let vDouble: number = 0;
            let vStr: string = '';

            let vType: string = '';
            if (typeof(tag.value) === 'number') {
                vType = ThriftUtils._thrift.TagType.DOUBLE;
                vDouble = tag.value;
            } else if (typeof(tag.value) === 'boolean') {
                vType = ThriftUtils._thrift.TagType.BOOL;
                vBool = tag.value;
            } else if (tag.value instanceof Long) { //TODO(oibe) how else to recognize a long?
                vType = ThriftUtils._thrift.TagType.LONG;
                vLong = tag.value;
            } else if (tag.value instanceof Buffer) {
                vType = ThriftUtils._thrift.TagType.BINARY;
                vBinary = tag.value;
            } else {
                vType = ThriftUtils._thrift.TagType.STRING;
                vStr = tag.value;
            }

            thriftTags.push({
                key: key,
                vType: vType,
                vStr: vStr,
                vDouble: vDouble,
                vBool: vBool,
                vLong: vLong,
                vBinary: vBinary
            });
        }

        return thriftTags;
    }

    static getThriftLogs(logs: Array<LogData>): Array<any> {
        let thriftLogs = [];
        for (let i = 0; i < logs.length; i++) {
            let log = logs[i];
            thriftLogs.push({
                'timestamp': log.timestamp,
                'fields': ThriftUtils.getThriftTags(log.fields)
            });
        }

        return thriftLogs;
    }

    static spanToThrift(span: Span): any {
        let tags = ThriftUtils.getThriftTags(span._tags);
        let logs = ThriftUtils.getThriftLogs(span._logs);
        let unsigned = true;

        return {
            traceIdLow: span._spanContext.traceId,
            traceIdHigh: ThriftUtils.emptyBuffer,  // TODO(oibe) implement 128 bit ids
            spanId: span._spanContext.spanId,
            parentSpanId: span._spanContext.parentId || ThriftUtils.emptyBuffer,
            operationName: span._operationName,
            references: [], // TODO(oibe) revist correctness after a spanRef diff is landed.
            flags: span._spanContext.flags,
            startTime: Utils.encodeInt64(span._startTime),
            duration: Utils.encodeInt64(span._duration),
            tags: tags,
            logs: logs
        }
    }
}

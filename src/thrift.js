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
import opentracing from 'opentracing';
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
            let valueType = typeof(tag.value);
            if (valueType === 'number') {
                vType = ThriftUtils._thrift.TagType.DOUBLE;
                vDouble = tag.value;
            } else if (valueType === 'boolean') {
                vType = ThriftUtils._thrift.TagType.BOOL;
                vBool = tag.value;
            } else if (tag.value instanceof Buffer) {
                vType = ThriftUtils._thrift.TagType.BINARY;
                vBinary = tag.value;
            } else if (valueType === 'object') {
                vType = ThriftUtils._thrift.TagType.STRING;
                vStr = JSON.stringify(tag.value);
            } else {
                vType = ThriftUtils._thrift.TagType.STRING;
                if (valueType === 'string') {
                    vStr = tag.value;
                } else {
                    vStr = String(tag.value);
                }
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
                'timestamp': Utils.encodeInt64(log.timestamp * 1000), // to microseconds
                'fields': ThriftUtils.getThriftTags(log.fields)
            });
        }

        return thriftLogs;
    }

    static spanRefsToThriftRefs(refs: Array<Reference>): Array<any> {
        let thriftRefs = [];
        for (let i = 0; i < refs.length; i++) {
            let refEnum;
            let ref = refs[i];
            let context = refs[i].referencedContext();

            if (ref.type() === opentracing.REFERENCE_CHILD_OF) {
                refEnum = ThriftUtils._thrift.SpanRefType.CHILD_OF;
            } else if (ref.type() === opentracing.REFERENCE_FOLLOWS_FROM) {
                refEnum = ThriftUtils._thrift.SpanRefType.FOLLOWS_FROM
            } else {
                continue;
            }

            thriftRefs.push({
                refType: refEnum,
                traceIdLow: context.traceId,
                traceIdHigh: ThriftUtils.emptyBuffer,
                spanId: context.spanId
            });
        }

        return thriftRefs;
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
            references: ThriftUtils.spanRefsToThriftRefs(span._references),
            flags: span._spanContext.flags,
            startTime: Utils.encodeInt64(span._startTime * 1000), // to microseconds
            duration: Utils.encodeInt64(span._duration * 1000), // to microseconds
            tags: tags,
            logs: logs
        }
    }
}

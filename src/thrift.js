// @flow
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

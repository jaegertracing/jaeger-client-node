'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _thriftrw = require('thriftrw');

var _util = require('./util.js');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ThriftUtils = function () {
    function ThriftUtils() {
        _classCallCheck(this, ThriftUtils);
    }

    _createClass(ThriftUtils, null, [{
        key: 'getThriftTags',
        value: function getThriftTags(initialTags) {
            var thriftTags = [];
            for (var i = 0; i < initialTags.length; i++) {
                var tag = initialTags[i];

                var key = tag.key;

                var vLong = ThriftUtils.emptyBuffer;
                var vBinary = ThriftUtils.emptyBuffer;
                var vBool = false;
                var vDouble = 0;
                var vStr = '';

                var vType = '';
                var valueType = _typeof(tag.value);
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
    }, {
        key: 'getThriftLogs',
        value: function getThriftLogs(logs) {
            var thriftLogs = [];
            for (var i = 0; i < logs.length; i++) {
                var log = logs[i];
                thriftLogs.push({
                    'timestamp': _util2.default.encodeInt64(log.timestamp * 1000), // to microseconds
                    'fields': ThriftUtils.getThriftTags(log.fields)
                });
            }

            return thriftLogs;
        }
    }, {
        key: 'spanRefsToThriftRefs',
        value: function spanRefsToThriftRefs(refs) {
            var thriftRefs = [];
            for (var i = 0; i < refs.length; i++) {
                var refEnum = void 0;
                var ref = refs[i];
                var context = refs[i].referencedContext();

                if (ref.type() === _opentracing2.default.REFERENCE_CHILD_OF) {
                    refEnum = ThriftUtils._thrift.SpanRefType.CHILD_OF;
                } else if (ref.type() === _opentracing2.default.REFERENCE_FOLLOWS_FROM) {
                    refEnum = ThriftUtils._thrift.SpanRefType.FOLLOWS_FROM;
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
    }, {
        key: 'spanToThrift',
        value: function spanToThrift(span) {
            var tags = ThriftUtils.getThriftTags(span._tags);
            var logs = ThriftUtils.getThriftLogs(span._logs);
            var unsigned = true;

            return {
                traceIdLow: span._spanContext.traceId,
                traceIdHigh: ThriftUtils.emptyBuffer, // TODO(oibe) implement 128 bit ids
                spanId: span._spanContext.spanId,
                parentSpanId: span._spanContext.parentId || ThriftUtils.emptyBuffer,
                operationName: span._operationName,
                references: ThriftUtils.spanRefsToThriftRefs(span._references),
                flags: span._spanContext.flags,
                startTime: _util2.default.encodeInt64(span._startTime * 1000), // to microseconds
                duration: _util2.default.encodeInt64(span._duration * 1000), // to microseconds
                tags: tags,
                logs: logs
            };
        }
    }]);

    return ThriftUtils;
}();

ThriftUtils._thrift = new _thriftrw.Thrift({
    source: _fs2.default.readFileSync(_path2.default.join(__dirname, './jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
    allowOptionalArguments: true
});
ThriftUtils.emptyBuffer = new Buffer([0, 0, 0, 0, 0, 0, 0, 0]);
exports.default = ThriftUtils;
//# sourceMappingURL=thrift.js.map
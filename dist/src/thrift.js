'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _long = require('long');

var _long2 = _interopRequireDefault(_long);

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
                if (typeof tag.value === 'number') {
                    vType = ThriftUtils._thrift.TagType.DOUBLE;
                    vDouble = tag.value;
                } else if (typeof tag.value === 'boolean') {
                    vType = ThriftUtils._thrift.TagType.BOOL;
                    vBool = tag.value;
                } else if (tag.value instanceof _long2.default) {
                    //TODO(oibe) how else to recognize a long?
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
    }, {
        key: 'getThriftLogs',
        value: function getThriftLogs(logs) {
            var thriftLogs = [];
            for (var i = 0; i < logs.length; i++) {
                var log = logs[i];
                thriftLogs.push({
                    'timestamp': log.timestamp,
                    'fields': ThriftUtils.getThriftTags(log.fields)
                });
            }

            return thriftLogs;
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
                references: [], // TODO(oibe) revist correctness after a spanRef diff is landed.
                flags: span._spanContext.flags,
                startTime: _util2.default.encodeInt64(span._startTime),
                duration: _util2.default.encodeInt64(span._duration),
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
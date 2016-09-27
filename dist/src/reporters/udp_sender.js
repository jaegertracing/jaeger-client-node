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

var _constants = require('../constants.js');

var constants = _interopRequireWildcard(_constants);

var _dgram = require('dgram');

var _dgram2 = _interopRequireDefault(_dgram);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _thriftrw = require('thriftrw');

var _span = require('../span.js');

var _span2 = _interopRequireDefault(_span);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HOST = 'localhost';
var PORT = 6832;
var DEFAULT_UDP_SPAN_SERVER_HOST_PORT = HOST + ':' + PORT;
var UDP_PACKET_MAX_LENGTH = 65000;

var UDPSender = function () {
    function UDPSender() {
        var hostPort = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DEFAULT_UDP_SPAN_SERVER_HOST_PORT;
        var maxPacketSize = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : UDP_PACKET_MAX_LENGTH;

        _classCallCheck(this, UDPSender);

        this._hostPort = hostPort;
        this._maxPacketSize = maxPacketSize;
        this._maxSpanBytes = this._maxPacketSize - constants.EMIT_SPAN_BATCH_OVERHEAD;
        this._byteBufferSize = 0;
        this._spanBuffer = [];
        this._client = _dgram2.default.createSocket('udp4');
        this._spec = _fs2.default.readFileSync(_path2.default.join(__dirname, '../jaeger-idl/thrift/jaeger.thrift'), 'ascii');
        this._thrift = new _thriftrw.Thrift({
            source: this._spec,
            allowOptionalArguments: true
        });
    }

    _createClass(UDPSender, [{
        key: '_calcSpanSize',
        value: function _calcSpanSize(span) {
            var thriftJaegerSpan = this._thrift.getType('Span');
            var buffer = thriftJaegerSpan.toBufferResult(span).value;
            return buffer.length;
        }
    }, {
        key: 'setProcess',
        value: function setProcess(process) {
            this._process = process;
        }
    }, {
        key: 'append',
        value: function append(span) {
            var spanSize = this._calcSpanSize(span);
            if (spanSize > this._maxSpanBytes) {
                return { err: true, numSpans: 1 };
            }

            this._byteBufferSize += spanSize;
            if (this._byteBufferSize <= this._maxSpanBytes) {
                this._spanBuffer.push(span);
                if (this._byteBufferSize < this._maxSpanBytes) {
                    return { err: false, numSpans: 0 };
                }
                return this.flush();
            }

            var flushResponse = this.flush();
            this._spanBuffer.push(span);
            this._byteBufferSize = spanSize;
            return flushResponse;
        }
    }, {
        key: 'flush',
        value: function flush(testCallback) {
            var numSpans = this._spanBuffer.length;
            if (numSpans == 0) {
                return { err: false, numSpans: 1 };
            }

            var thriftJaegerArgs = this._thrift.getType('Agent::emitBatch_args');
            var batch = {
                process: this._process,
                spans: this._spanBuffer
            };
            var bufferResult = thriftJaegerArgs.toBufferResult({ batch: batch });
            if (bufferResult.err) {
                console.log('err', bufferResult.err);
                return { err: true, numSpans: numSpans };
            }

            var thriftBuffer = bufferResult.value;
            this._client.send(thriftBuffer, 0, thriftBuffer.length, PORT, HOST);
            this._reset();

            if (testCallback) {
                testCallback();
            }

            return { err: false, numSpans: numSpans };
        }
    }, {
        key: '_reset',
        value: function _reset() {
            this._spanBuffer = [];
            this._byteBufferSize = 0;
        }
    }, {
        key: 'close',
        value: function close(callback) {
            this._client.close();

            if (callback) {
                callback();
            }
        }
    }]);

    return UDPSender;
}();

exports.default = UDPSender;
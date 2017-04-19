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

var _dgram = require('dgram');

var _dgram2 = _interopRequireDefault(_dgram);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _thriftrw = require('thriftrw');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HOST = 'localhost';
var PORT = 6832;
var UDP_PACKET_MAX_LENGTH = 65000;

var UDPSender = function () {
    function UDPSender() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, UDPSender);

        this._host = options.host || HOST;
        this._port = options.port || PORT;
        this._maxPacketSize = options.maxPacketSize || UDP_PACKET_MAX_LENGTH;
        this._byteBufferSize = 0;
        this._client = _dgram2.default.createSocket('udp4');
        this._spec = _fs2.default.readFileSync(_path2.default.join(__dirname, '../jaeger-idl/thrift/jaeger.thrift'), 'ascii');
        this._thrift = new _thriftrw.Thrift({
            source: this._spec,
            allowOptionalArguments: true
        });
    }

    _createClass(UDPSender, [{
        key: '_calcBatchSize',
        value: function _calcBatchSize(batch) {
            return this._thrift.Agent.emitBatch.argumentsMessageRW.byteLength(this._convertBatchToThriftMessage(this._batch)).length;
        }
    }, {
        key: '_calcSpanSize',
        value: function _calcSpanSize(span) {
            return this._thrift.Span.rw.byteLength(new this._thrift.Span(span)).length;
        }
    }, {
        key: 'setProcess',
        value: function setProcess(process) {
            // This function is only called once during reporter construction, and thus will
            // give us the length of the batch before any spans have been added to the span
            // list in batch.
            this._process = process;
            this._batch = {
                'process': this._process,
                'spans': []
            };

            var tagMessages = [];
            for (var j = 0; j < this._batch.process.tags.length; j++) {
                var tag = this._batch.process.tags[j];
                tagMessages.push(new this._thrift.Tag(tag));
            }

            this._thriftProcessMessage = new this._thrift.Process({
                serviceName: this._batch.process.serviceName,
                tags: tagMessages
            });
            this._emitSpanBatchOverhead = this._calcBatchSize(this._batch);
            this._maxSpanBytes = this._maxPacketSize - this._emitSpanBatchOverhead;
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
                this._batch.spans.push(span);
                if (this._byteBufferSize < this._maxSpanBytes) {
                    return { err: false, numSpans: 0 };
                }
                return this.flush();
            }

            var flushResponse = this.flush();
            this._batch.spans.push(span);
            this._byteBufferSize = spanSize;
            return flushResponse;
        }
    }, {
        key: 'flush',
        value: function flush() {
            var numSpans = this._batch.spans.length;
            if (numSpans == 0) {
                return { err: false, numSpans: 0 };
            }

            var bufferLen = this._byteBufferSize + this._emitSpanBatchOverhead;
            var thriftBuffer = new Buffer(bufferLen);
            var bufferResult = this._thrift.Agent.emitBatch.argumentsMessageRW.writeInto(this._convertBatchToThriftMessage(this._batch), thriftBuffer, 0);

            if (bufferResult.err) {
                console.log('err', bufferResult.err);
                return { err: true, numSpans: numSpans };
            }

            // TODO(oibe) use callback in send
            this._client.send(thriftBuffer, 0, thriftBuffer.length, this._port, this._host);
            this._reset();

            return { err: false, numSpans: numSpans };
        }
    }, {
        key: '_convertBatchToThriftMessage',
        value: function _convertBatchToThriftMessage() {
            var spanMessages = [];
            for (var i = 0; i < this._batch.spans.length; i++) {
                var span = this._batch.spans[i];
                spanMessages.push(new this._thrift.Span(span));
            }

            return new this._thrift.Agent.emitBatch.ArgumentsMessage({
                version: 1,
                id: 0,
                body: { batch: new this._thrift.Batch({
                        process: this._thriftProcessMessage,
                        spans: spanMessages
                    }) }
            });
        }
    }, {
        key: '_reset',
        value: function _reset() {
            this._batch.spans = [];
            this._byteBufferSize = 0;
        }
    }, {
        key: 'close',
        value: function close() {
            this._client.close();
        }
    }]);

    return UDPSender;
}();

exports.default = UDPSender;
//# sourceMappingURL=udp_sender.js.map
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

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

var _dgram = require('dgram');

var _dgram2 = _interopRequireDefault(_dgram);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _thriftrw = require('thriftrw');

var _logger = require('../logger.js');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HOST = 'localhost';
var PORT = 6832;
var UDP_PACKET_MAX_LENGTH = 65000;

var UDPSender = function () {
    // size of currently batched spans as Thrift bytes

    function UDPSender() {
        var _this = this;

        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, UDPSender);

        this._host = options.host || HOST;
        this._port = options.port || PORT;
        this._maxPacketSize = options.maxPacketSize || UDP_PACKET_MAX_LENGTH;
        this._logger = options.logger || new _logger2.default();
        this._client = _dgram2.default.createSocket('udp4');
        this._client.on('error', function (err) {
            _this._logger.error('error sending spans over UDP: ' + err);
        });
        this._agentThrift = new _thriftrw.Thrift({
            entryPoint: _path2.default.join(__dirname, '../thriftrw-idl/agent.thrift'),
            allowOptionalArguments: true,
            allowFilesystemAccess: true
        });
        this._jaegerThrift = new _thriftrw.Thrift({
            source: _fs2.default.readFileSync(_path2.default.join(__dirname, '../jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
            allowOptionalArguments: true
        });
        this._totalSpanBytes = 0;
    } // maxPacketSize - (batch + tags overhead)


    _createClass(UDPSender, [{
        key: '_calcBatchSize',
        value: function _calcBatchSize(batch) {
            return this._agentThrift.Agent.emitBatch.argumentsMessageRW.byteLength(this._convertBatchToThriftMessage(this._batch)).length;
        }
    }, {
        key: '_calcSpanSize',
        value: function _calcSpanSize(span) {
            return this._jaegerThrift.Span.rw.byteLength(new this._jaegerThrift.Span(span));
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
                tagMessages.push(new this._jaegerThrift.Tag(tag));
            }

            this._thriftProcessMessage = new this._jaegerThrift.Process({
                serviceName: this._batch.process.serviceName,
                tags: tagMessages
            });
            this._emitSpanBatchOverhead = this._calcBatchSize(this._batch);
            this._maxSpanBytes = this._maxPacketSize - this._emitSpanBatchOverhead;
        }
    }, {
        key: 'append',
        value: function append(span) {
            var lengthResult = this._calcSpanSize(span);
            if (lengthResult.err) {
                this._logger.error('error converting span to Thrift: ' + lengthResult.err);
                return { err: true, numSpans: 1 };
            }
            var spanSize = lengthResult.length;
            if (spanSize > this._maxSpanBytes) {
                return { err: true, numSpans: 1 };
            }

            if (this._totalSpanBytes + spanSize <= this._maxSpanBytes) {
                this._batch.spans.push(span);
                this._totalSpanBytes += spanSize;
                if (this._totalSpanBytes < this._maxSpanBytes) {
                    // still have space in the buffer, don't flush it yet
                    return { err: false, numSpans: 0 };
                }
                return this.flush();
            }

            var flushResponse = this.flush();
            this._batch.spans.push(span);
            this._totalSpanBytes = spanSize;
            return flushResponse;
        }
    }, {
        key: 'flush',
        value: function flush() {
            var _this2 = this;

            var numSpans = this._batch.spans.length;
            if (numSpans == 0) {
                return { err: false, numSpans: 0 };
            }

            var bufferLen = this._totalSpanBytes + this._emitSpanBatchOverhead;
            var thriftBuffer = new Buffer(bufferLen);
            var writeResult = void 0;

            try {
                writeResult = this._agentThrift.Agent.emitBatch.argumentsMessageRW.writeInto(this._convertBatchToThriftMessage(this._batch), thriftBuffer, 0);
            } catch (err) {
                this._logger.error('error writing Thrift object: ' + err + ', batch: ' + this._batch + ', length: ' + bufferLen);
                console.log('error writing Thrift object: ' + err + ', batch: ' + this._batch + ', length: ' + bufferLen);
                this._reset();
                return { err: true, numSpans: numSpans };
            }

            if (writeResult.err) {
                this._logger.error('error writing Thrift object: ' + writeResult.err);
                return { err: true, numSpans: numSpans };
            }

            // Having the error callback here does not prevent uncaught exception from being thrown,
            // that's why in the constructor we also add a general on('error') handler.
            this._client.send(thriftBuffer, 0, thriftBuffer.length, this._port, this._host, function (err, sent) {
                if (err) {
                    _this2._logger.error('error sending spans over UDP: ' + err + ', packet size: ' + writeResult.offset + ', bytes sent: ' + sent);
                }
            });
            this._reset();

            return { err: false, numSpans: numSpans };
        }
    }, {
        key: '_convertBatchToThriftMessage',
        value: function _convertBatchToThriftMessage() {
            var spanMessages = [];
            for (var i = 0; i < this._batch.spans.length; i++) {
                var span = this._batch.spans[i];
                spanMessages.push(new this._jaegerThrift.Span(span));
            }

            return new this._agentThrift.Agent.emitBatch.ArgumentsMessage({
                version: 1,
                id: 0,
                body: { batch: new this._jaegerThrift.Batch({
                        process: this._thriftProcessMessage,
                        spans: spanMessages
                    }) }
            });
        }
    }, {
        key: '_reset',
        value: function _reset() {
            this._batch.spans = [];
            this._totalSpanBytes = 0;
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
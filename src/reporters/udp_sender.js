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

import dgram from 'dgram';
import path from 'path';
import thriftify from 'thriftify';
import Span from '../span.js';

const HOST = 'localhost';
const PORT =  5775;
const DEFAULT_UDP_SPAN_SERVER_HOST_PORT = `${HOST}:${PORT}`;
const EMIT_SPAN_BATCH_OVERHEAD = 30;
const UDP_PACKET_MAX_LENGTH = 65000;

export default class UDPSender {
    _hostPort: string;
    _maxPacketSize: number;
    _maxSpanBytes: number;
    _spanBuffer: Array<Span>;
    _thriftBuffer: Buffer;
    _client: any;
    _spec: any;
    _byteBufferSize: number;

    constructor(hostPort: string = DEFAULT_UDP_SPAN_SERVER_HOST_PORT,
                maxPacketSize: number = UDP_PACKET_MAX_LENGTH) {
        this._hostPort = hostPort;
        this._maxPacketSize = maxPacketSize;
        this._maxSpanBytes = this._maxPacketSize - EMIT_SPAN_BATCH_OVERHEAD;
        this._byteBufferSize = 0;
        this._spanBuffer = [];
        this._client = dgram.createSocket('udp4');
        this._spec = thriftify.readSpecSync(path.join(__dirname, '../reporter.thrift'));
    }

    _calcSpanSize(span: any): number {
        let buffer: Buffer = thriftify.toBuffer(span, this._spec, 'Span');
        return buffer.length;
    }

    append(span: any): SenderResponse {
        let spanSize: number = this._calcSpanSize(span);
        if (spanSize > this._maxSpanBytes) {
            return { err: true, numSpans: 1 };
        }

        this._byteBufferSize += spanSize;
        if (this._byteBufferSize <= this._maxSpanBytes) {
            this._spanBuffer.push(span);
            if (this._byteBufferSize < this._maxSpanBytes) {
                return {err: false, numSpans: 0};
            }
            return this.flush();
        }

        let flushResponse: SenderResponse = this.flush();
        this._spanBuffer.push(span);
        this._byteBufferSize = spanSize;
        return flushResponse;
    }

    flush(callback: ?Function): SenderResponse {
        let numSpans: number = this._spanBuffer.length;
        if (numSpans == 0) {
            return {err: false, numSpans: 1}
        }

        let thriftBuffer: Buffer = thriftify.toBuffer({spans: this._spanBuffer}, this._spec, 'Agent::emitZipkinBatch_args');
        this._client.send(thriftBuffer, 0, thriftBuffer.length, PORT, HOST);

        this._reset();

        if (callback) {
            callback();
        }

        return {err: false, numSpans: numSpans};
    }

    _reset() {
        this._spanBuffer = [];
        this._byteBufferSize = 0;
    }

    close(callback: Function): void {
        this._client.close();

        if (callback) {
            callback();
        }
    }
}

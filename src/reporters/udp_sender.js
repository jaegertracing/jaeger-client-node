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

import * as constants from '../constants.js';
import dgram from 'dgram';
import fs from 'fs';
import path from 'path';
import {Thrift} from 'thriftrw';
import Span from '../span.js';

const HOST = 'localhost';
const PORT =  6832;
const DEFAULT_UDP_SPAN_SERVER_HOST_PORT = `${HOST}:${PORT}`;
const UDP_PACKET_MAX_LENGTH = 65000;

export default class UDPSender {
    _hostPort: string;
    _maxPacketSize: number;
    _process: Process;
    _maxSpanBytes: number;
    _spanBuffer: Array<Span>;
    _thriftBuffer: Buffer;
    _client: any;
    _spec: any;
    _byteBufferSize: number;
    _thrift: any;

    constructor(hostPort: string = DEFAULT_UDP_SPAN_SERVER_HOST_PORT,
                maxPacketSize: number = UDP_PACKET_MAX_LENGTH) {
        this._hostPort = hostPort;
        this._maxPacketSize = maxPacketSize;
        this._maxSpanBytes = this._maxPacketSize - constants.EMIT_SPAN_BATCH_OVERHEAD;
        this._byteBufferSize = 0;
        this._spanBuffer = [];
        this._client = dgram.createSocket('udp4');
        this._spec = fs.readFileSync(path.join(__dirname, '../jaeger-idl/thrift/jaeger.thrift'), 'ascii');
        this._thrift = new Thrift({
            source: this._spec,
            allowOptionalArguments: true
        });
    }

    _calcSpanSize(span: any): number {
        let thriftJaegerSpan = this._thrift.getType('Span');
        let buffer: Buffer = thriftJaegerSpan.toBufferResult(span).value;
        return buffer.length;
    }

    setProcess(process: Process): void {
        this._process = process;
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

    flush(testCallback: ?Function): SenderResponse {
        let numSpans: number = this._spanBuffer.length;
        if (numSpans == 0) {
            return {err: false, numSpans: 1}
        }

        let thriftJaegerArgs = this._thrift.getType('Agent::emitBatch_args');
        let batch = {
            process: this._process,
            spans: this._spanBuffer
        };
        let bufferResult = thriftJaegerArgs.toBufferResult({batch: batch});
        if (bufferResult.err) {
            console.log('err', bufferResult.err);
            return {err: true, numSpans: numSpans};
        }

        let thriftBuffer: Buffer = bufferResult.value;
        this._client.send(thriftBuffer, 0, thriftBuffer.length, PORT, HOST);
        this._reset();

        if (testCallback) {
            testCallback();
        }

        return {err: false, numSpans: numSpans};
    }

    _reset() {
        this._spanBuffer = [];
        this._byteBufferSize = 0;
    }

    close(callback: ?Function): void {
        this._client.close();

        if (callback) {
            callback();
        }
    }
}

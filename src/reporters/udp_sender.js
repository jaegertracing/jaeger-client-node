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

import dgram from 'dgram';
import fs from 'fs';
import path from 'path';
import {Thrift} from 'thriftrw';
import NullLogger from '../logger.js';

const HOST = 'localhost';
const PORT =  6832;
const UDP_PACKET_MAX_LENGTH = 65000;

export default class UDPSender {
    _host: string;
    _port: number;
    _maxPacketSize: number;
    _process: Process;
    _emitSpanBatchOverhead: number;
    _logger: Logger;
    _client: dgram$Socket;
    _agentThrift: Thrift;
    _jaegerThrift: Thrift;
    _batch: Batch;
    _thriftProcessMessage: any;
    _maxSpanBytes: number;   // maxPacketSize - (batch + tags overhead)
    _totalSpanBytes: number; // size of currently batched spans as Thrift bytes

    constructor(options: any = {}) {
        this._host = options.host || HOST;
        this._port = options.port || PORT;
        this._maxPacketSize = options.maxPacketSize || UDP_PACKET_MAX_LENGTH;
        this._logger = options.logger || new NullLogger();
        this._client = dgram.createSocket('udp4');
        this._client.on('error', err => {
            this._logger.error(`error sending spans over UDP: ${err}`)
        })
        this._agentThrift = new Thrift({
            entryPoint: path.join(__dirname, '../thriftrw-idl/agent.thrift'),
            allowOptionalArguments: true,
            allowFilesystemAccess: true
        });
        this._jaegerThrift = new Thrift({
            source: fs.readFileSync(path.join(__dirname, '../jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
            allowOptionalArguments: true
        });
        this._totalSpanBytes = 0;
    }

    _calcBatchSize(batch: Batch) {
        return this._agentThrift.Agent.emitBatch.argumentsMessageRW.byteLength(
            this._convertBatchToThriftMessage(this._batch)
        ).length;
    }

    _calcSpanSize(span: any): number {
        return this._jaegerThrift.Span.rw.byteLength(new this._jaegerThrift.Span(span)).length;
    }

    setProcess(process: Process): void {
        // This function is only called once during reporter construction, and thus will
        // give us the length of the batch before any spans have been added to the span
        // list in batch.
        this._process = process;
        this._batch = {
            'process': this._process,
            'spans': []
        };

        let tagMessages = [];
        for (let j = 0; j < this._batch.process.tags.length; j++) {
            let tag = this._batch.process.tags[j];
            tagMessages.push(new this._jaegerThrift.Tag(tag));
        }

        this._thriftProcessMessage = new this._jaegerThrift.Process({
            serviceName: this._batch.process.serviceName,
            tags: tagMessages
        });
        this._emitSpanBatchOverhead = this._calcBatchSize(this._batch);
        this._maxSpanBytes = this._maxPacketSize - this._emitSpanBatchOverhead;
    }

    append(span: any): SenderResponse {
        let spanSize: number = this._calcSpanSize(span);
        if (spanSize > this._maxSpanBytes) {
            return { err: true, numSpans: 1 };
        }

        if (this._totalSpanBytes + spanSize <= this._maxSpanBytes) {
            this._batch.spans.push(span);
            this._totalSpanBytes += spanSize;
            if (this._totalSpanBytes < this._maxSpanBytes) {
                // still have space in the buffer, don't flush it yet
                return {err: false, numSpans: 0};
            }
            return this.flush();
        }

        let flushResponse: SenderResponse = this.flush();
        this._batch.spans.push(span);
        this._totalSpanBytes = spanSize;
        return flushResponse;
    }

    flush(): SenderResponse {
        let numSpans: number = this._batch.spans.length;
        if (numSpans == 0) {
            return {err: false, numSpans: 0}
        }

        let bufferLen = this._totalSpanBytes + this._emitSpanBatchOverhead;
        let thriftBuffer = new Buffer(bufferLen);
        let writeResult = this._agentThrift.Agent.emitBatch.argumentsMessageRW.writeInto(
            this._convertBatchToThriftMessage(this._batch), thriftBuffer, 0
        );

        if (writeResult.err) {
            this._logger.error(`error writing Thrift object: ${writeResult.err}`);
            return {err: true, numSpans: numSpans};
        }

        // Having the error callback here does not prevent uncaught exception from being thrown,
        // that's why in the constructor we also add a general on('error') handler.
        this._client.send(thriftBuffer, 0, thriftBuffer.length, this._port, this._host, (err, sent) => {
            if (err) {
                this._logger.error(`error sending spans over UDP: ${err}, packet size: ${writeResult.offset}, bytes sent: ${sent}`);
            }
        });
        this._reset();

        return {err: false, numSpans: numSpans};
    }

    _convertBatchToThriftMessage() {
        let spanMessages = [];
        for (let i = 0; i < this._batch.spans.length; i++) {
            let span = this._batch.spans[i];
            spanMessages.push(new this._jaegerThrift.Span(span))
        }

        return new this._agentThrift.Agent.emitBatch.ArgumentsMessage({
            version: 1,
            id: 0,
            body: {batch: new this._jaegerThrift.Batch({
                    process: this._thriftProcessMessage,
                    spans: spanMessages
            })}
        });
    }

    _reset() {
        this._batch.spans = [];
        this._totalSpanBytes = 0;
    }

    close(): void {
        this._client.close();
    }
}

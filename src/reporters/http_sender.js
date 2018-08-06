// @flow
// Copyright (c) 2018 Uber Technologies, Inc.
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
import http from 'http';
import path from 'path';
import * as URL from 'url';
import { Thrift } from 'thriftrw';

import NullLogger from '../logger.js';
import SenderUtils from './sender_utils.js';

const DEFAULT_PATH = '/api/traces';
const DEFAULT_PORT = 14268;
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_SPAN_BATCH_SIZE = 100;

export default class HTTPSender {
  _url: Object;
  _username: string;
  _password: string;
  _emitSpanBatchOverhead: number;
  _timeoutMS: number;
  _httpAgent: http$Agent;
  _logger: Logger;
  _jaegerThrift: Thrift;
  _process: Process;
  _batch: Batch;
  _thriftProcessMessage: any;
  _maxSpanBatchSize: number;
  _httpOptions: Object;

  constructor(options: any = {}) {
    this._url = URL.parse(options.endpoint);
    this._username = options.username;
    this._password = options.password;
    this._timeoutMS = options.timeoutMS || DEFAULT_TIMEOUT_MS;
    this._httpAgent = new http.Agent({ keepAlive: true });

    this._maxSpanBatchSize = options.maxSpanBatchSize || DEFAULT_MAX_SPAN_BATCH_SIZE;

    this._logger = options.logger || new NullLogger();
    this._jaegerThrift = new Thrift({
      source: fs.readFileSync(path.join(__dirname, '../jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
      allowOptionalArguments: true,
    });

    this._httpOptions = {
      protocol: this._url.protocol,
      hostname: this._url.hostname,
      port: this._url.port,
      path: this._url.pathname,
      method: 'POST',
      auth: this._username && this._password ? `${this._username}:${this._password}` : undefined,
      headers: {
        'Content-Type': 'application/x-thrift',
        Connection: 'keep-alive',
      },
      agent: this._httpAgent,
      timeout: this._timeoutMS,
    };
  }

  setProcess(process: Process): void {
    // Go ahead and initialize the Thrift batch that we will reuse for each
    // flush.
    this._batch = new this._jaegerThrift.Batch({
      process: SenderUtils.convertProcessToThrift(this._jaegerThrift, process),
      spans: [],
    });
  }

  append(span: any, callback?: SenderCallback): void {
    this._batch.spans.push(new this._jaegerThrift.Span(span));

    if (this._batch.spans.length >= this._maxSpanBatchSize) {
      this.flush(callback);
      return;
    }
    SenderUtils.invokeCallback(callback, 0);
  }

  flush(callback?: SenderCallback): void {
    const numSpans = this._batch.spans.length;
    if (!numSpans) {
      SenderUtils.invokeCallback(callback, 0);
      return;
    }

    const result = this._jaegerThrift.Batch.rw.toBuffer(this._batch);
    if (result.err) {
      SenderUtils.invokeCallback(callback, numSpans, `Error encoding Thrift batch: ${result.err}`);
      return;
    }

    this._reset();

    const req = http.request(this._httpOptions, resp => {
      SenderUtils.invokeCallback(callback, numSpans);
    });

    req.on('error', err => {
      const error: string = `error sending spans over HTTP: ${err}`;
      this._logger.error(error);
      SenderUtils.invokeCallback(callback, numSpans, error);
    });
    req.write(result.value);
    req.end();
  }

  _reset() {
    this._batch.spans = [];
  }

  close(): void {
    // Older node versions don't have this.
    if (this._httpAgent.destroy) {
      this._httpAgent.destroy();
    }
  }
}

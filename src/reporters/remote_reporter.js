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

import NullLogger from '../logger.js';
import ThriftUtils from '../thrift.js';
import Metrics from '../metrics/metrics.js';
import NoopMetricFactory from '../metrics/noop/metric_factory';

const DEFAULT_BUFFER_FLUSH_INTERVAL_MILLIS = 10000;

export default class RemoteReporter {
    _bufferFlushInterval: number;
    _logger: Logger;
    _sender: Sender;
    _intervalHandle: any;
    _process: Process;
    _metrics: any;

    constructor(sender: Sender,
                options: any = {}) {
        if (!sender) {
            throw new Error('RemoteReporter must be given a Sender.');
        }

        this._bufferFlushInterval = options.bufferFlushInterval || DEFAULT_BUFFER_FLUSH_INTERVAL_MILLIS;
        this._logger = options.logger || new NullLogger();
        this._sender = sender;
        this._intervalHandle = setInterval(() => {
            this.flush();
        }, this._bufferFlushInterval);
        this._metrics = options.metrics || new Metrics(new NoopMetricFactory());
    }

    name(): string {
        return 'RemoteReporter';
    }

    report(span: Span): void {
        let response: SenderResponse = this._sender.append(ThriftUtils.spanToThrift(span));
        if (response.err) {
            this._logger.error('Failed to append spans in reporter.');
            this._metrics.reporterDropped.increment(response.numSpans);
        }
    }

    flush(callback: ?Function): void {
        let response: SenderResponse = this._sender.flush();
        if (response.err) {
            this._logger.error('Failed to flush spans in reporter.');
            this._metrics.reporterFailure.increment(response.numSpans);
        } else {
            this._metrics.reporterSuccess.increment(response.numSpans);
        }

        if (callback) {
            callback();
        }
    }

    close(callback: ?Function): void {
        clearInterval(this._intervalHandle);
        this._sender.flush();
        this._sender.close();

        if (callback) {
            callback();
        }
    }

    setProcess(serviceName: string, tags: Array<Tag>): void {
        this._process = {
            'serviceName': serviceName,
            'tags': ThriftUtils.getThriftTags(tags)
        };

        this._sender.setProcess(this._process);
    }
}

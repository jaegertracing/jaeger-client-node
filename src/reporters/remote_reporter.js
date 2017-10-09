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

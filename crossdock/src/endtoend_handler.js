// @flow
// Copyright (c) 2017 Uber Technologies, Inc.
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

import {initTracer} from '../../src/index';
import * as constants from '../../src/constants.js';

export default class EndToEndHandler {
    _tracers: {};

    /**
     * Handler that creates traces from a http request.
     *
     * json: {
     *   "type": "remote"
     *   "operation": "operationName",
     *   "count": 2,
     *   "tags": {
     *     "key": "value"
     *   }
     * }
     *
     * Given the above json payload, the handler will use a tracer with the RemoteSampler to
     * create 2 traces for the "operationName" operation with the tags: {"key":"value"}.
     * These traces are reported to the agent with the hostname "test_driver".
     *
     * @param {object} [options] - optional settings
     * @param {string} [options.host] - host for jaeger-agent reporting endpoint, defaults to 'test_driver'
     * @param {number} [options.port] - port for jaeger-agent reporting endpoint, defaults to 6832
     */
    constructor(options: any = {}) {
        this._tracers = {};
        let tracerConfig: any = {
            serviceName: "crossdock-node",
            reporter: {
                flushIntervalMs: 1000,
                agentHost: options.host || "test_driver",
                agentPort: options.port || 6832
            },
            sampler: {
                type: constants.SAMPLER_TYPE_REMOTE,
                param: 1,
                host: "test_driver",
                port: 5778,
                refreshIntervalMs: 5000
            }
        };
        this._tracers[constants.SAMPLER_TYPE_REMOTE] = initTracer(tracerConfig);

        tracerConfig.sampler.type = constants.SAMPLER_TYPE_CONST;
        this._tracers[constants.SAMPLER_TYPE_CONST] = initTracer(tracerConfig);
    }

    generateTraces(req: any, res: any): void {
        let traceRequest = req.body;
        let samplerType = traceRequest.type || constants.SAMPLER_TYPE_REMOTE;
        this._createTraces(samplerType, traceRequest.operation, traceRequest.count, traceRequest.tags);
        res.sendStatus(200);
    }

    _createTraces(samplerType: string, operationName: string, numTraces: number, tags: any): void {
        for (let i = 0; i < numTraces; i++) {
            this._createAndReportTrace(samplerType, operationName, tags);
        }
    }

    _createAndReportTrace(samplerType: string, operationName: string, tags: any): void {
        let span = this._tracers[samplerType].startSpan(operationName, {tags: tags});
        span.finish();
    }
}

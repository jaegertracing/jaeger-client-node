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
import Tracer from '../../src/tracer.js';
import * as constants from './constants.js';

export default class EndToEndHandler {
    _tracer: Tracer;

    constructor() {
        let tracerConfig: any = {
            serviceName: "crossdock-node",
            reporter: {
                flushIntervalMs: 1000,
                agentHost: "test_driver",
                agentPort: 6832
            },
            sampler: {
                type: constants.SAMPLER_TYPE_REMOTE,
                param: 1.0,
                host: "test_driver",
                port: 5778,
                refreshIntervalMs: 5000
            }
        };
        this._tracer = initTracer(tracerConfig);
    };

    generateTraces(req: any, res: any): void {
        let traceRequest = req.body;
        this.createTraces(
            traceRequest.operation,
            traceRequest.count,
            traceRequest.tags
        );
        res.send(200);
    }

    createTraces(operationName: string, numTraces: number, tags: any): void {
        for (let i = 0; i < numTraces; i++) {
            this.createAndReportTrace(operationName, tags);
        }
    }

    createAndReportTrace(operationName: string, tags: any): void {
        let span = this._tracer.startSpan(operationName, {tags: tags});
        span.finish();
    }
}

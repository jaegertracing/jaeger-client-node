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

import bodyParser from 'body-parser';
import express from 'express';
import {initTracer} from '../../src/index';
import Tracer from '../../src/tracer.js';

export default class IntegrationServer {
    _tracer: Tracer;

    constructor() {
        this._tracer;
        let app = express();

        app.use(bodyParser.json());

        // TODO:oibe Should we really remove this endpoint?
        app.post('/init', (req, res) => {
            let initRequest: any = req.body;
            let samplerHostPort: Array<String> = initRequest.sampler.localAgentHostPort.split(':');
            let reporterHostPort: Array<String> = initRequest.reporter.localAgentHostPort.split(':');

            let tracerConfig: any = {
                serviceName: initRequest.service,
                reporter: {
                    // TODO:oibe make sure this has been changed to milliseconds
                    flushIntervalMs: initRequest.reporter.bufferFlushInterval,
                    agentHost: reporterHostPort[0],
                    agentPort: parseInt(reporterHostPort[1])
                },
                sampler: {
                    type: initRequest.sampler.type,
                    param: initRequest.sampler.param,
                    host: samplerHostPort[0],
                    port: parseInt(samplerHostPort[1])
                }
            };

            this._tracer = initTracer(tracerConfig);
            res.send(200);
        });

        app.post('/trace', (req, res) => {
            if (!this._tracer) {
                console.log('No tracer was initialized.');
                return;
            }

            let traceRequest = req.body;
            this.createTraces(
                traceRequest.operation,
                traceRequest.count,
                traceRequest.tags
            );
            res.send(200);
        });

        app.listen(8080, () => { console.log('Listening on port 8080'); });
    }

    createTraces(operationName: string, numTraces: number, tags: any) {
        for (let i = 0; i < numTraces; i++) {
            this.createAndReportTrace(operationName, tags);
        }
    }

    createAndReportTrace(operationName: string, tags: any) {
        let span = this._tracer.startSpan(operationName, {tags: tags});
        span.finish();
    }
}

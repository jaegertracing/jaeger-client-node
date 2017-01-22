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
import ConstSampler from '../../src/samplers/const_sampler.js';
import express from 'express';
import Helpers from './helpers';
import InMemoryReporter from '../../src/reporters/in_memory_reporter.js';
import opentracing from 'opentracing';
import Tracer from '../../src/tracer.js';
import EndToEndHandler from "./endtoend_handler";

export default class HttpServer {
    _tracer: Tracer;
    _helpers: Helpers;

    constructor() {
        let app = express();
        this._tracer = new Tracer('node', new InMemoryReporter(), new ConstSampler(false));
        this._helpers = new Helpers(this._tracer);
        let handler = new EndToEndHandler();

        // json responses need bodyParser when working with express
        app.use(bodyParser.json());

        let endpoints: Array<any> = [
            {url: '/start_trace', startRequest: true},
            {url: '/join_trace', startRequest: false}
        ];

        endpoints.forEach((endpoint) => {
            app.post(endpoint.url, (req, res) => {
                let parentContext = this._tracer.extract(opentracing.FORMAT_HTTP_HEADERS, req.headers);
                let serverSpan = this._tracer.startSpan(endpoint.url, { childOf: parentContext });
                let traceRequest = req.body;

                Helpers.log('HTTP', traceRequest.serverRole, 'received request', Helpers.json2str(traceRequest));

                let promise: any = this._helpers.handleRequest(
                    endpoint.startRequest,
                    traceRequest,
                    serverSpan
                );
                promise.then((response) => {
                    serverSpan.finish();
                    let traceResponse = JSON.stringify(response);
                    res.send(traceResponse);
                });
            });
        });
        app.post('/create_traces', (req, res) => {
            handler.generateTraces(req, res);
        });
        app.listen(8081, () => {
            Helpers.log('HTTP server listening on port 8081...');
        });
    }
}

if ((require: any).main === module) {
    let http = new HttpServer();
}

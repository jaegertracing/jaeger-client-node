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

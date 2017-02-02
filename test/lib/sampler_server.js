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

import express from 'express';

export default class SamplingServer {
    _port: number;
    _app: any;
    _server: any;
    _strategies: { [service: string]: SamplingStrategyResponse };

    constructor(port: number = 5778) {
        this._port = port;
        this._app = express();
        this._strategies = Object.create(null);
        this._app.get('/sampling', this._handle.bind(this));
    }

    addStrategy(serviceName: string, response: SamplingStrategyResponse): void {
        this._strategies[serviceName] = response;
    }

    clearStrategies(): void {
        this._strategies = Object.create(null);
    }

    _handle(req: any, res: any) {
        let service = req.query.service;
        let strategy = this._strategies[service];
        if (strategy) {
            res.send(strategy);
        } else {
            res.status(404).send({err: `unknown service name '${service}'`});
        }
    }

    start(): SamplingServer {
        this._server = this._app.listen(this._port);
        return this;
    }

    close(): void {
        this._server.close();
    }
}

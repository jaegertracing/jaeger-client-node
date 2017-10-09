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

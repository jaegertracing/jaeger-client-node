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

export default class ConfigServer {
  _port: number;
  _app: any;
  _server: any;
  _strategies: { [service: string]: SamplingStrategyResponse };
  _credits: { [service: string]: Array<CreditResponse> };

  constructor(port: number = 5778) {
    this._port = port;
    this._app = express();
    this._strategies = {};
    this._app.get('/sampling', this._handleSampling.bind(this));
    this._app.get('/credits', this._handleThrottling.bind(this));
  }

  addStrategy(serviceName: string, response: SamplingStrategyResponse): void {
    this._strategies[serviceName] = response;
  }

  addCredits(serviceName: string, response: Array<CreditResponse>): void {
    this._credits[serviceName] = response;
  }

  clearConfigs(): void {
    this._strategies = {};
    this._credits = {};
  }

  _handleSampling(req: any, res: any) {
    this._handle(req, res, service => {
      return this._strategies[service];
    });
  }

  _handleThrottling(req: any, res: any) {
    this._handle(req, res, service => {
      return { balances: this._credits[service] };
    });
  }

  _handle(req: any, res: any, getFunc: Function) {
    const service = req.query.service;
    const resp = getFunc(service);
    if (resp) {
      res.send(resp);
    } else {
      res.status(404).send({ err: `unknown service name '${service}'` });
    }
  }

  start(): ConfigServer {
    this._server = this._app.listen(this._port);
    return this;
  }

  close(): void {
    this._server.close();
  }
}

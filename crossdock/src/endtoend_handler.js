// @flow
// Copyright (c) 2017 Uber Technologies, Inc.
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
                agentHost: options.host || "jaeger-agent",
                agentPort: options.port || 6832
            },
            sampler: {
                type: constants.SAMPLER_TYPE_REMOTE,
                param: 1,
                host: "jaeger-agent",
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

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

import * as constants from './constants.js';
import ConstSampler from '../../src/samplers/const_sampler.js';
import DefaultContext from '../../src/default_context.js';
import Helpers from './helpers';
import InMemoryReporter from '../../src/reporters/in_memory_reporter.js';
import Tracer from '../../src/tracer.js';
import opentracing from 'opentracing';
import path from 'path';
import TChannelBridge from '../../src/tchannel_bridge';

import TChannel from 'tchannel';
import TChannelThrift from 'tchannel/as/thrift';
import Utils from '../../src/util.js';

let DEFAULT_THRIFT_PATH = '/crossdock/tracetest.thrift';
export default class TChannelServer {
    _tracer: Tracer;
    _helpers: any;

    constructor(crossdockSpecPath: string = DEFAULT_THRIFT_PATH) {
        this._tracer = new Tracer('node', new InMemoryReporter(), new ConstSampler(false));
        this._helpers = new Helpers(this._tracer);

        let serverChannel = TChannel({'serviceName': 'node'});
        let tchannelThrift = TChannelThrift({
            'channel': serverChannel,
            'entryPoint': crossdockSpecPath
        });
        let context = new DefaultContext();

        let bridge = new TChannelBridge(this._tracer);
        let tracedHandler = bridge.tracedHandler(this.handleTChannelRequest.bind(this));
        tchannelThrift.register(serverChannel, 'TracedService::joinTrace', context, tracedHandler);

        serverChannel.listen(8082, Utils.myIp(), () => {
            Helpers.log('TChannel server listening on port 8082...');
        });
    }

    handleTChannelRequest(perProcessOptions: any, req: any, head: any, body: any, callback: Function) {
        let isStartRequest: boolean = false;
        let traceRequest = body.request;
        let context = req.context;
        Helpers.log('TChannel', traceRequest.serverRole, 'received joinTrace request', Helpers.json2str(traceRequest));

        let promise = this._helpers.handleRequest(
            isStartRequest,
            traceRequest,
            context.getSpan()
        );

        promise.then((tchannelResp) => {
            callback(null, {
                'ok': true,
                'body': tchannelResp
                }
            );
        });
    }
}

if ((require:any).main === module) {
    let tchannel = new TChannelServer();
}

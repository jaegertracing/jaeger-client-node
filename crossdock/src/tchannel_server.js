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

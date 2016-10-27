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

    constructor(path=DEFAULT_THRIFT_PATH) {
        this._path = path;
        this._tracer = new Tracer('node', new InMemoryReporter(), new ConstSampler(false));
        this._helpers = new Helpers(this._tracer);

        let crossdockSpecPath = this._path;
        let serverChannel = TChannel({'serviceName': 'node'});
        let tchannelThrift = TChannelThrift({
            'channel': serverChannel,
            'entryPoint': crossdockSpecPath
        });

        tchannelThrift.register(serverChannel, 'TracedService::joinTrace', {}, this.handleTChannelRequest.bind(this));

        serverChannel.listen(8082, Utils.myIp(), () => {
            console.log('TChannel server listening on port 8082...');
        });
    }

    handleTChannelRequest(context: any, req: any, head: any, body: any, callback: Function) {
        let startRequest: boolean = false;
        let traceRequest = body.request;
        let spanContext = TChannelBridge.getSpanFromTChannelRequest(this._tracer, 'tchannel-server-span', head).context();

        let promise = this._helpers.handleRequest(
            startRequest,
            'join_trace#tchannel',
            traceRequest,
            spanContext
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

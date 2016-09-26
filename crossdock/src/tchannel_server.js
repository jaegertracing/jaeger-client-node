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
import path from 'path';

// $FlowIgnore - tchannel is installed in docker container
import TChannel from 'tchannel';
// $FlowIgnore - tchannel is installed in docker container
import TChannelThrift from 'tchannel/as/thrift';
import Utils from '../../src/util.js';

export default class TChannelServer {
    constructor() {
        let crossdockSpecPath = path.join(__dirname, '..', '..', 'src', 'jaeger-idl', 'thrift', 'crossdock', 'tracetest.thrift');
        let serverChannel = TChannel({'serviceName': 'node'});
        let tchannelThrift = TChannelThrift({
            'channel': serverChannel,
            'entryPoint': crossdockSpecPath
        });

        let startTraceContext = {};
        let joinTraceContext = {};
        tchannelThrift.register(serverChannel, 'TracedService::startTrace', startTraceContext, this.startTrace.bind(this));
        tchannelThrift.register(serverChannel, 'TracedService::joinTrace', joinTraceContext, this.joinTrace.bind(this));

        serverChannel.listen(8082, Utils.myIp(), () => {
            console.log('TChannel server listening on port 8082...');
        });
    }

    startTrace(context: any, req: any, head: any, body: any, callback: Function) {
        let startTraceRequest = body['request'];
        let span = this.observeSpan(context)

        callback(null, {
                'ok': true,
                'body': {
                    'notImplementedError': 'TChannel crossdock not implemented for node.',
                    'span': span
                }
            });
    }

    joinTrace(context: any, req: any, head: any, body: any, callback: Function) {
        let joinTraceRequest = body['request'];
        let span = this.observeSpan(context);

        callback(null, {
                'ok': true,
                'body': {
                    'notImplementedError': 'TChannel crossdock not implemented for node.',
                    'span': span
                }
            });
    }

    observeSpan(context: any): ObservedSpan {
        console.log('observe_span_context', context);
        let span = context.span;
        if (!span) {
            return {
                traceId: 'no span found',
                sampled: false,
                baggage: 'no span found'
            };
        }

        return {
            traceId: Utils.removeLeadingZeros(span.context().traceId.toString('hex')),
            sampled: context.span.context().isSampled(),
            baggage: span.getBaggageItem(constants.BAGGAGE_KEY)
        };
    }
}

if (require.main === module) {
    let tchannel = new TChannelServer();
}

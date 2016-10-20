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

import {assert} from 'chai';
import TChannelServer from '../src/tchannel_server.js';
import TChannelAsThrift from 'tchannel/as/thrift';
import TChannel from 'tchannel';
import fs from 'fs';
import path from 'path';
import Utils from '../../src/util.js';

// WARNING THESE TESTS DO NOT WORK WHEN THE VPN IS RUNNING.

describe('crossdock tchannel server should', () => {
    let ip;
    let server;
    let crossdockSpecPath = path.join(__dirname, '..', '..', 'src', 'jaeger-idl', 'thrift', 'crossdock', 'tracetest.thrift');
    before(() => {
        server = new TChannelServer();
        ip = Utils.myIp();
    });

    it ('return not implemented response for join_trace', (done) => {
        let clientChannel = new TChannel();
        var requestChannel = clientChannel.makeSubChannel({
            serviceName: 'node',
            peers: [Utils.myIp() + ':8082']
        });
        var tchannelAsThrift = TChannelAsThrift({
            channel: requestChannel,
            entryPoint: crossdockSpecPath
        });

        let joinRequest = {
            'serverRole': 'S1',
            'downstream': {
                'serviceName': 'node',
                'serverRole': 'S1',
                'host': 'node',
                'port': '8082',
                'transport': 'TCHANNEL'
            }
        };

        tchannelAsThrift.request({
            serviceName: 'node',
            headers: {
                cn: 'node-tchannel'
            },
            hasNoParent: true
        }).send('TracedService::joinTrace', null,
            {'request': joinRequest}, (err, res) => {
            if (err) {
                console.log('got error', err);
            } else {
                let traceResponse = res.body;
                assert.equal(traceResponse.span.traceId, 'no span found');
                assert.equal(traceResponse.span.sampled, false);
                assert.equal(traceResponse.span.baggage, 'no span found');
                assert.equal(traceResponse.notImplementedError, 'TChannel crossdock not implemented for node.');
            }
            done();
        });


    });
});

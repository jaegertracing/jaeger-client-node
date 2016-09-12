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
import ConstSampler from '../src/samplers/const_sampler.js';
import dgram from 'dgram';
import fs from 'fs';
import path from 'path';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import TestUtils from './lib/util.js';
import Tracer from '../src/tracer.js';
import {Thrift} from 'thriftrw';
import UDPSender from '../src/reporters/udp_sender.js';

const PORT = 5775;
const HOST = '127.0.0.1';

describe('udp sender should', () => {
    let server;
    let tracer;
    let thrift;

    before(() => {
        server = dgram.createSocket('udp4');
        server.bind(PORT, HOST);
        tracer = new Tracer(
            'test-service-name',
            new InMemoryReporter(),
            new ConstSampler(true)
        );
        thrift = new Thrift({
            source: fs.readFileSync(path.join(__dirname, '../src/jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
            allowOptionalArguments: true
        });
    });

    after(() => {
        tracer.close();
    });

    it ('read and verify spans sent', (done) => {
        let sender = new UDPSender();
        let spanOne = tracer.startSpan('operation-one');
        spanOne.finish(); // finish to set span duration
        spanOne = spanOne._toThrift();
        let spanTwo = tracer.startSpan('operation-two');
        spanTwo.finish(); // finish to set span duration
        spanTwo = spanTwo._toThrift();

        server.on('message', (msg, remote) => {
            let thriftJaegerArgs = thrift.getType('Agent::emitJaegerBatch_args');
            let thriftObj = thriftJaegerArgs.fromBufferResult(msg).value;
            assert.isOk(thriftObj.spans);
            assert.equal(thriftObj.spans.length, 2);
            assert.isOk(TestUtils.thriftSpanEqual(spanOne, thriftObj.spans[0]));
            assert.isOk(TestUtils.thriftSpanEqual(spanTwo, thriftObj.spans[1]));
            sender.close();
            done();
        });

        sender.append(spanOne);
        sender.append(spanTwo);

        // cleanup
        sender.flush();
    });

    it('flush spans after capacity is met', () => {
        let spanOne = tracer.startSpan('operation-one');
        spanOne.finish(); // finish to set span duration
        spanOne = spanOne._toThrift();
        let sender = new UDPSender(undefined, 1);
        let spanSize = sender._calcSpanSize(spanOne);

        // because of zipkin batch overhead being > 0 append on the second
        // span won't have enough space, and the buffer will be flushed.
        sender = new UDPSender(undefined, spanSize * 2);

        let responseOne = sender.append(spanOne);
        let responseTwo = sender.append(spanOne);

        assert.equal(responseOne.err, false);
        assert.equal(responseOne.numSpans, 0);
        assert.equal(responseTwo.err, false);
        assert.equal(responseTwo.numSpans, 1);

        // the span that wasn't flushed gets appended
        assert.equal(sender._spanBuffer.length, 1);
        assert.equal(sender._byteBufferSize, spanSize);
    });

    it ('return error response on span too large', () => {
        let sender = new UDPSender(undefined, 1);
        let response = sender.append({'key': 'keyone', 'value': 'valueone'});
        assert.isOk(response.err);
        assert.equal(response.numSpans, 1);
        sender.flush();

        // cleanup
        sender.close();
    });
});

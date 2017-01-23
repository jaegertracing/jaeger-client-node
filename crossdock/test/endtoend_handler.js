// Copyright (c) 2017 Uber Technologies, Inc.
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
import dgram from 'dgram';
import fs from 'fs';
import EndToEndHandler from '../src/endtoend_handler';
import path from 'path';
import request from 'request';
import JaegerTestUtils from '../../src/test_util';
import {Thrift} from 'thriftrw';
import bodyParser from 'body-parser';
import express from 'express';

const PORT = 6832;
const HOST = '127.0.0.1';

describe('Endtoend Handler should', () => {
    let server;
    let thrift;

    beforeEach(() => {
        server = dgram.createSocket('udp4');
        server.bind(PORT, HOST);
        thrift = new Thrift({
            source: fs.readFileSync(path.join(__dirname, '../../src/jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
            allowOptionalArguments: true
        });

        let handler = new EndToEndHandler({port: PORT, host: HOST});
        let app = express();
        app.use(bodyParser.json());
        app.post('/create_traces', (req, res) => {
            handler.generateTraces(req, res);
        });

        app.listen(8083, () => {});
    });

    afterEach(() => {
        server.close();
    });

    it ('report spans to local server', (done) => {
        let traceRequest = {
            operation: 'leela',
            count: 5,
            tags: { 'key': 'value'}
        };

        let headers = {'Content-Type': 'application/json'};
        request.post({
            'url': 'http://127.0.0.1:8083/create_traces',
            'forever': true,
            'headers': headers,
            'body': JSON.stringify(traceRequest)
        }, (err, response) => {});

        function thriftTagsToObject(span: Span) {
            let tags = [];
            let value;
            span.tags.forEach((tag) => {
                if (tag.vType === 'STRING') {
                    value = tag.vStr;
                } else if (tag.vType === 'DOUBLE') {
                    value = tag.vDouble;
                } else if (tag.vType === 'BOOL') {
                    value = tag.vBool;
                } else if (tag.vType === 'LONG') {
                    value = tag.vLong;
                } else {
                    value = tag.vBinary;
                }

                tags.push({key: tag.key,  value: value});
            });
            return tags;
        }
        server.on('listening', function () {
            let address = server.address();
        });
        server.on('message', function(msg, remote) {
            let thriftObj = thrift.Agent.emitBatch.argumentsMessageRW.readFrom(msg, 0);
            let batch = thriftObj.value.body.batch;

            assert.equal(batch.spans.length, 5);

            batch.spans.forEach((span) => {
                span._tags = thriftTagsToObject(span);
                assert.equal(span.operationName, 'leela');
                assert.isOk(JaegerTestUtils.hasTags(span, {
                    'key': 'value'
                }));
            });
            done();
        });
    });
});

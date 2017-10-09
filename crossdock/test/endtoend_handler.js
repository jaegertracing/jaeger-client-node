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
            entryPoint: path.join(__dirname, '../../src/thriftrw-idl/agent.thrift'),
            allowOptionalArguments: true,
            allowFilesystemAccess: true
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

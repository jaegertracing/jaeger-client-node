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
import HttpServer from '../src/http_server.js';
import request from 'request';

process.env.NODE_ENV = 'test';

describe('crossdock http server should', () => {
    let server;
    before(() => {
        server = new HttpServer();
    });

    it('return proper trace response for start_request, and join_trace combined', (done) => {
        let sampled = true;
        let baggage = "7e859ffef96e5da6";
        let host = "127.0.0.1";
        let startRequest = {
            "serverRole": "S1",
            "sampled": sampled,
            "baggage": baggage,
            "downstream": {
                "serviceName": "node",
                "serverRole": "S2",
                "host": host,
                "port": "8081",
                "transport": "HTTP",
                "downstream": {
                    "serviceName": "node",
                    "serverRole": "S3",
                    "host": host,
                    "port": "8081",
                    "transport": "HTTP"
                }
            }
        };

        setTimeout(() => {
            let headers = { 'Content-Type': 'application/json' };
            request.post({
                'url': 'http://127.0.0.1:8081/start_trace',
                'forever': true,
                'headers': headers,
                'body': JSON.stringify(startRequest)
            }, (err, response) => {
                if (err) {
                    console.log('err', err);
                }

                // top level span
                assert.isNotOk(err);
                let traceResponse = JSON.parse(response.body);
                assert.isOk(traceResponse.span.traceId);
                assert.equal(traceResponse.span.sampled, true);
                assert.equal(traceResponse.span.baggage, '7e859ffef96e5da6');

                // downstream level 1
                assert.isOk(traceResponse.downstream);
                assert.equal(traceResponse.notImplementedError, '');
                assert.equal(traceResponse.span.traceId, traceResponse.downstream.span.traceId);
                assert.equal(traceResponse.downstream.span.sampled, true);
                assert.equal(traceResponse.downstream.span.baggage, '7e859ffef96e5da6');
                assert.equal(traceResponse.downstream.notImplementedError, '');

                // downstream level 2
                assert.isOk(traceResponse.downstream.downstream);
                assert.equal(traceResponse.downstream.span.traceId, traceResponse.downstream.downstream.span.traceId);
                assert.equal(traceResponse.downstream.downstream.notImplementedError, '');
                assert.isOk(traceResponse.downstream.downstream.span.sampled, true);
                assert.isOk(traceResponse.downstream.downstream.span.baggage, '7e859ffef96e5da6');
                done();
            });
        }, 3000);
    }).timeout(5000);

    it('return proper trace response for start_request', (done) => {
        let sampled = true;
        let baggage = "7e859ffef96e5da6";
        let host = "127.0.0.1";
        let startRequest = {
            "serverRole": "S1",
            "sampled": sampled,
            "baggage": baggage
        };

        let headers = { 'Content-Type': 'application/json' };
        request.post({
            'url': 'http://127.0.0.1:8081/start_trace',
            'forever': true,
            'headers': headers,
            'body': JSON.stringify(startRequest)
        }, (err, response) => {
            if (err) {
                console.log('err', err);
            }
            assert.isNotOk(err);
            let traceResponse = JSON.parse(response.body);
            assert.equal(traceResponse.span.sampled, true);
            assert.equal(traceResponse.span.baggage, '7e859ffef96e5da6');
            assert.equal(traceResponse.notImplementedError, '');
            done();
        });
    });

    it('return proper trace response for join_request', (done) => {
        let sampled = true;
        let baggage = "7e859ffef96e5da6";
        let host = "127.0.0.1";
        let joinRequest = {
            "serverRole": "S1",
        };

        let headers = { 'Content-Type': 'application/json' };
        request.post({
            'url': 'http://127.0.0.1:8081/join_trace',
            'forever': true,
            'headers': headers,
            'body': JSON.stringify(joinRequest)
        }, (err, response) => {
            if (err) {
                console.log('err', err);
            }

            assert.isNotOk(err);
            let traceResponse = JSON.parse(response.body);
            assert.equal(traceResponse.span.sampled, false);
            assert.equal(traceResponse.notImplementedError, '');
            done();
        });
    });
});

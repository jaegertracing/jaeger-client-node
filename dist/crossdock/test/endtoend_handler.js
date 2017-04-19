'use strict';

var _chai = require('chai');

var _dgram = require('dgram');

var _dgram2 = _interopRequireDefault(_dgram);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _endtoend_handler = require('../src/endtoend_handler');

var _endtoend_handler2 = _interopRequireDefault(_endtoend_handler);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _test_util = require('../../src/test_util');

var _test_util2 = _interopRequireDefault(_test_util);

var _thriftrw = require('thriftrw');

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

var PORT = 6832;
var HOST = '127.0.0.1';

describe('Endtoend Handler should', function () {
    var server = void 0;
    var thrift = void 0;

    beforeEach(function () {
        server = _dgram2.default.createSocket('udp4');
        server.bind(PORT, HOST);
        thrift = new _thriftrw.Thrift({
            source: _fs2.default.readFileSync(_path2.default.join(__dirname, '../../src/jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
            allowOptionalArguments: true
        });

        var handler = new _endtoend_handler2.default({ port: PORT, host: HOST });
        var app = (0, _express2.default)();
        app.use(_bodyParser2.default.json());
        app.post('/create_traces', function (req, res) {
            handler.generateTraces(req, res);
        });

        app.listen(8083, function () {});
    });

    afterEach(function () {
        server.close();
    });

    it('report spans to local server', function (done) {
        var traceRequest = {
            operation: 'leela',
            count: 5,
            tags: { 'key': 'value' }
        };

        var headers = { 'Content-Type': 'application/json' };
        _request2.default.post({
            'url': 'http://127.0.0.1:8083/create_traces',
            'forever': true,
            'headers': headers,
            'body': JSON.stringify(traceRequest)
        }, function (err, response) {});

        function thriftTagsToObject(span) {
            var tags = [];
            var value = void 0;
            span.tags.forEach(function (tag) {
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

                tags.push({ key: tag.key, value: value });
            });
            return tags;
        }
        server.on('listening', function () {
            var address = server.address();
        });
        server.on('message', function (msg, remote) {
            var thriftObj = thrift.Agent.emitBatch.argumentsMessageRW.readFrom(msg, 0);
            var batch = thriftObj.value.body.batch;

            _chai.assert.equal(batch.spans.length, 5);

            batch.spans.forEach(function (span) {
                span._tags = thriftTagsToObject(span);
                _chai.assert.equal(span.operationName, 'leela');
                _chai.assert.isOk(_test_util2.default.hasTags(span, {
                    'key': 'value'
                }));
            });
            done();
        });
    });
});
//# sourceMappingURL=endtoend_handler.js.map
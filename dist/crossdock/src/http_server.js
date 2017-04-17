'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _const_sampler = require('../../src/samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _helpers = require('./helpers');

var _helpers2 = _interopRequireDefault(_helpers);

var _in_memory_reporter = require('../../src/reporters/in_memory_reporter.js');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _tracer = require('../../src/tracer.js');

var _tracer2 = _interopRequireDefault(_tracer);

var _endtoend_handler = require('./endtoend_handler');

var _endtoend_handler2 = _interopRequireDefault(_endtoend_handler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
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

var HttpServer = function HttpServer() {
    var _this = this;

    _classCallCheck(this, HttpServer);

    var app = (0, _express2.default)();
    this._tracer = new _tracer2.default('node', new _in_memory_reporter2.default(), new _const_sampler2.default(false));
    this._helpers = new _helpers2.default(this._tracer);
    var handler = new _endtoend_handler2.default();

    // json responses need bodyParser when working with express
    app.use(_bodyParser2.default.json());

    var endpoints = [{ url: '/start_trace', startRequest: true }, { url: '/join_trace', startRequest: false }];

    endpoints.forEach(function (endpoint) {
        app.post(endpoint.url, function (req, res) {
            var parentContext = _this._tracer.extract(_opentracing2.default.FORMAT_HTTP_HEADERS, req.headers);
            var serverSpan = _this._tracer.startSpan(endpoint.url, { childOf: parentContext });
            var traceRequest = req.body;

            _helpers2.default.log('HTTP', traceRequest.serverRole, 'received request', _helpers2.default.json2str(traceRequest));

            var promise = _this._helpers.handleRequest(endpoint.startRequest, traceRequest, serverSpan);
            promise.then(function (response) {
                serverSpan.finish();
                var traceResponse = JSON.stringify(response);
                res.send(traceResponse);
            });
        });
    });
    app.post('/create_traces', function (req, res) {
        handler.generateTraces(req, res);
    });
    app.listen(8081, function () {
        _helpers2.default.log('HTTP server listening on port 8081...');
    });
};

exports.default = HttpServer;


if (require.main === module) {
    var http = new HttpServer();
}
//# sourceMappingURL=http_server.js.map
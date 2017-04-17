'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _index = require('../../src/index');

var _constants = require('../../src/constants.js');

var constants = _interopRequireWildcard(_constants);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EndToEndHandler = function () {

    /**
     * Handler that creates traces from a http request.
     *
     * json: {
     *   "type": "remote"
     *   "operation": "operationName",
     *   "count": 2,
     *   "tags": {
     *     "key": "value"
     *   }
     * }
     *
     * Given the above json payload, the handler will use a tracer with the RemoteSampler to
     * create 2 traces for the "operationName" operation with the tags: {"key":"value"}.
     * These traces are reported to the agent with the hostname "test_driver".
     *
     * @param {object} [options] - optional settings
     * @param {string} [options.host] - host for jaeger-agent reporting endpoint, defaults to 'test_driver'
     * @param {number} [options.port] - port for jaeger-agent reporting endpoint, defaults to 6832
     */
    function EndToEndHandler() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, EndToEndHandler);

        this._tracers = {};
        var tracerConfig = {
            serviceName: "crossdock-node",
            reporter: {
                flushIntervalMs: 1000,
                agentHost: options.host || "test_driver",
                agentPort: options.port || 6832
            },
            sampler: {
                type: constants.SAMPLER_TYPE_REMOTE,
                param: 1,
                host: "test_driver",
                port: 5778,
                refreshIntervalMs: 5000
            }
        };
        this._tracers[constants.SAMPLER_TYPE_REMOTE] = (0, _index.initTracer)(tracerConfig);

        tracerConfig.sampler.type = constants.SAMPLER_TYPE_CONST;
        this._tracers[constants.SAMPLER_TYPE_CONST] = (0, _index.initTracer)(tracerConfig);
    }

    _createClass(EndToEndHandler, [{
        key: 'generateTraces',
        value: function generateTraces(req, res) {
            var traceRequest = req.body;
            var samplerType = traceRequest.type || constants.SAMPLER_TYPE_REMOTE;
            this._createTraces(samplerType, traceRequest.operation, traceRequest.count, traceRequest.tags);
            res.sendStatus(200);
        }
    }, {
        key: '_createTraces',
        value: function _createTraces(samplerType, operationName, numTraces, tags) {
            for (var i = 0; i < numTraces; i++) {
                this._createAndReportTrace(samplerType, operationName, tags);
            }
        }
    }, {
        key: '_createAndReportTrace',
        value: function _createAndReportTrace(samplerType, operationName, tags) {
            var span = this._tracers[samplerType].startSpan(operationName, { tags: tags });
            span.finish();
        }
    }]);

    return EndToEndHandler;
}();

exports.default = EndToEndHandler;
//# sourceMappingURL=endtoend_handler.js.map
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _constants = require('./constants.js');

var constants = _interopRequireWildcard(_constants);

var _const_sampler = require('../../src/samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _default_context = require('../../src/default_context.js');

var _default_context2 = _interopRequireDefault(_default_context);

var _helpers = require('./helpers');

var _helpers2 = _interopRequireDefault(_helpers);

var _in_memory_reporter = require('../../src/reporters/in_memory_reporter.js');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _tracer = require('../../src/tracer.js');

var _tracer2 = _interopRequireDefault(_tracer);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _tchannel_bridge = require('../../src/tchannel_bridge');

var _tchannel_bridge2 = _interopRequireDefault(_tchannel_bridge);

var _tchannel = require('tchannel');

var _tchannel2 = _interopRequireDefault(_tchannel);

var _thrift = require('tchannel/as/thrift');

var _thrift2 = _interopRequireDefault(_thrift);

var _util = require('../../src/util.js');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DEFAULT_THRIFT_PATH = '/crossdock/tracetest.thrift';

var TChannelServer = function () {
    function TChannelServer() {
        var crossdockSpecPath = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DEFAULT_THRIFT_PATH;

        _classCallCheck(this, TChannelServer);

        this._tracer = new _tracer2.default('node', new _in_memory_reporter2.default(), new _const_sampler2.default(false));
        this._helpers = new _helpers2.default(this._tracer);

        var serverChannel = (0, _tchannel2.default)({ 'serviceName': 'node' });
        var tchannelThrift = (0, _thrift2.default)({
            'channel': serverChannel,
            'entryPoint': crossdockSpecPath
        });
        var context = new _default_context2.default();

        var bridge = new _tchannel_bridge2.default(this._tracer);
        var tracedHandler = bridge.tracedHandler(this.handleTChannelRequest.bind(this));
        tchannelThrift.register(serverChannel, 'TracedService::joinTrace', context, tracedHandler);

        serverChannel.listen(8082, _util2.default.myIp(), function () {
            _helpers2.default.log('TChannel server listening on port 8082...');
        });
    }

    _createClass(TChannelServer, [{
        key: 'handleTChannelRequest',
        value: function handleTChannelRequest(perProcessOptions, req, head, body, callback) {
            var isStartRequest = false;
            var traceRequest = body.request;
            var context = req.context;
            _helpers2.default.log('TChannel', traceRequest.serverRole, 'received joinTrace request', _helpers2.default.json2str(traceRequest));

            var promise = this._helpers.handleRequest(isStartRequest, traceRequest, context.getSpan());

            promise.then(function (tchannelResp) {
                callback(null, {
                    'ok': true,
                    'body': tchannelResp
                });
            });
        }
    }]);

    return TChannelServer;
}();

exports.default = TChannelServer;


if (require.main === module) {
    var tchannel = new TChannelServer();
}
//# sourceMappingURL=tchannel_server.js.map
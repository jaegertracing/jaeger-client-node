'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _chai = require('chai');

var _constants = require('../src/constants');

var constants = _interopRequireWildcard(_constants);

var _const_sampler = require('../src/samplers/const_sampler');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _default_context = require('../src/default_context');

var _default_context2 = _interopRequireDefault(_default_context);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _in_memory_reporter = require('../src/reporters/in_memory_reporter');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _test_util = require('../src/test_util.js');

var _test_util2 = _interopRequireDefault(_test_util);

var _tracer = require('../src/tracer');

var _tracer2 = _interopRequireDefault(_tracer);

var _tchannel = require('tchannel');

var _tchannel2 = _interopRequireDefault(_tchannel);

var _tchannel_bridge = require('../src/tchannel_bridge.js');

var _tchannel_bridge2 = _interopRequireDefault(_tchannel_bridge);

var _thrift = require('tchannel/as/thrift');

var _thrift2 = _interopRequireDefault(_thrift);

var _json = require('tchannel/as/json');

var _json2 = _interopRequireDefault(_json);

var _combinations = require('./lib/combinations.js');

var _combinations2 = _interopRequireDefault(_combinations);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('test tchannel span bridge', function () {
    // BIG_TIMEOUT is useful for debugging purposes.
    var BIG_TIMEOUT = 15000000;
    var reporter = new _in_memory_reporter2.default();
    var tracer = new _tracer2.default('test-service', reporter, new _const_sampler2.default(true));
    var bridge = new _tchannel_bridge2.default(tracer, {
        contextFactory: function contextFactory() {
            return new _default_context2.default();
        }
    });
    var originalSpan = tracer.startSpan('futurama');
    originalSpan.setBaggageItem('leela', 'fry');
    var ctx1 = new _default_context2.default();
    ctx1.setSpan(originalSpan);

    var options = (0, _combinations2.default)({
        as: ['json', 'thrift'],
        mode: ['req.send', 'channel.send'],
        context: [ctx1, null],
        headers: [{}, null]
    });

    _lodash2.default.each(options, function (o) {
        o.description = 'as=' + o.as + '|mode=' + o.mode;
        o.channelEncoding = o.as === 'json' ? _json2.default : _thrift2.default;

        it(o.description + ' spans propagate through tchannel and preserve parent span properties', function (done) {
            var server = new _tchannel2.default({
                serviceName: 'server',
                timeout: BIG_TIMEOUT,
                // force tracing on in order to prove that overriding works
                trace: true,
                forceTrace: true
            });
            // Server calls client channel after it starts listening.
            server.listen(4040, '127.0.0.1', onServerListening);

            // Create the top level client channel.
            var client = new _tchannel2.default({
                // force tracing on in order to prove that overriding works
                trace: true,
                forceTrace: true
            });

            // Create the client subchannel that makes requests.
            var clientSubChannel = client.makeSubChannel({
                serviceName: 'server',
                peers: ['127.0.0.1:4040']
            });

            // Wrap the subchannel in an encoding
            var encodedChannel = o.channelEncoding({
                channel: clientSubChannel,
                entryPoint: _path2.default.join(__dirname, 'thrift', 'echo.thrift') // ignored in json case
            });

            var options = {};
            encodedChannel.register(server, 'Echo::echo', options, bridge.tracedHandler(handleServerReq));
            function handleServerReq(context, req, head, body, callback) {
                // headers should not contain $tracing$ prefixed keys, which should be the
                // only headers used for this test.
                _chai.assert.equal(Object.keys(head).length, 0);

                // assert that the serverSpan is a child of the original span, if context exists
                // assert that the serverSpan is NOT a child of the original span, if contexts is null
                _chai.assert.equal(originalSpan.context().traceIdStr === req.context.getSpan().context().traceIdStr, !!o.context);
                callback(null, { ok: true, body: { value: 'some-string' } });
            }

            function onServerListening(err, res, arg2, arg3) {
                // Outgoing tchannel call is traced
                var tracedChannel = bridge.tracedChannel(encodedChannel);

                var clientCallback = function clientCallback(err, res, headers, body) {
                    _chai.assert.isNotOk(err);
                    _chai.assert.equal(reporter.spans.length, 2);

                    // the first span to be reported is the server span
                    var serverSpan = reporter.spans[0];
                    // the second span to be reported is the client span
                    var clientSpan = reporter.spans[1];

                    var serverSpanTags = {};
                    serverSpanTags[_opentracing2.default.Tags.PEER_SERVICE] = 'echo';
                    serverSpanTags[_opentracing2.default.Tags.SPAN_KIND] = _opentracing2.default.Tags.SPAN_KIND_RPC_SERVER;
                    serverSpanTags['as'] = o.as;
                    // TODO(oibe) the port for the client request ephemeral, and I don't know how to get it, or if I can.

                    var clientSpanTags = {};
                    clientSpanTags[_opentracing2.default.Tags.PEER_SERVICE] = 'server';
                    clientSpanTags[_opentracing2.default.Tags.SPAN_KIND] = _opentracing2.default.Tags.SPAN_KIND_RPC_CLIENT;

                    _chai.assert.isOk(_test_util2.default.hasTags(serverSpan, serverSpanTags));
                    _chai.assert.isOk(_test_util2.default.hasTags(clientSpan, clientSpanTags));

                    _chai.assert.equal(serverSpan.context().parentIdStr, clientSpan.context().spanIdStr);
                    // If context exists then the following conditions are true
                    // else the following conditons are false
                    _chai.assert.equal(serverSpan.context().traceIdStr === originalSpan.context().traceIdStr, !!o.context);
                    _chai.assert.equal(clientSpan.context().traceIdStr === originalSpan.context().traceIdStr, !!o.context);

                    reporter.clear();
                    server.close();
                    client.close();
                    done();
                };

                if (o.mode === 'req.send') {
                    var req = tracedChannel.request({
                        serviceName: 'server',
                        headers: { cn: 'echo' },
                        context: o.context,
                        timeout: BIG_TIMEOUT
                    });
                    req.send('Echo::echo', o.headers, { value: 'some-string' }, clientCallback);
                } else if (o.mode === 'channel.send') {
                    var _req = tracedChannel.channel.request({
                        serviceName: 'server',
                        headers: { cn: 'echo' },
                        context: o.context,
                        timeout: BIG_TIMEOUT
                    });
                    tracedChannel.send(_req, 'Echo::echo', o.headers, { value: 'some-string' }, clientCallback);
                }
            }
        }).timeout(BIG_TIMEOUT);
    });
});
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
//# sourceMappingURL=tchannel_bridge.js.map
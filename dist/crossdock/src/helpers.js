'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
// Copyright (c) 2016 Uber Technologies, Inc.
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

var _constants = require('./constants.js');

var constants = _interopRequireWildcard(_constants);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _dns = require('dns');

var _dns2 = _interopRequireDefault(_dns);

var _default_context = require('../../src/default_context');

var _default_context2 = _interopRequireDefault(_default_context);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _rsvp = require('rsvp');

var _rsvp2 = _interopRequireDefault(_rsvp);

var _span = require('../../src/span.js');

var _span2 = _interopRequireDefault(_span);

var _span_context = require('../../src/span_context.js');

var _span_context2 = _interopRequireDefault(_span_context);

var _tracer = require('../../src/tracer.js');

var _tracer2 = _interopRequireDefault(_tracer);

var _channel = require('tchannel/channel');

var _channel2 = _interopRequireDefault(_channel);

var _thrift = require('tchannel/as/thrift');

var _thrift2 = _interopRequireDefault(_thrift);

var _tchannel_bridge = require('../../src/tchannel_bridge');

var _tchannel_bridge2 = _interopRequireDefault(_tchannel_bridge);

var _util = require('../../src/util.js');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Helpers = function () {
    function Helpers(tracer) {
        _classCallCheck(this, Helpers);

        this._tracer = tracer;

        var channel = (0, _channel2.default)().makeSubChannel({
            serviceName: 'node',
            peers: [_util2.default.myIp() + ':8082']
        });

        var crossdockSpec = _fs2.default.readFileSync(_path2.default.join(__dirname, '..', '..', 'src', 'jaeger-idl', 'thrift', 'crossdock', 'tracetest.thrift'), 'utf8');
        var thriftChannel = (0, _thrift2.default)({
            channel: channel,
            source: crossdockSpec
        });

        var bridge = new _tchannel_bridge2.default(this._tracer);
        this._tracedChannel = bridge.tracedChannel(thriftChannel);
    }

    _createClass(Helpers, [{
        key: 'handleRequest',
        value: function handleRequest(isStartRequest, traceRequest, serverSpan) {
            if (isStartRequest) {
                serverSpan.setBaggageItem(constants.BAGGAGE_KEY, traceRequest.baggage);
                if (traceRequest.sampled) {
                    serverSpan.setTag(_opentracing2.default.Tags.SAMPLING_PRIORITY, 1);
                }
            }

            // do async call to prepareResponse
            return this.prepareResponse(traceRequest.serverRole, traceRequest.downstream, serverSpan);
        }
    }, {
        key: 'prepareResponse',
        value: function prepareResponse(serverRole, downstream, serverSpan) {
            var _this = this;

            return new _rsvp2.default.Promise(function (resolve, reject) {
                var observedSpan = _this.observeSpan(serverSpan);
                var response = {
                    span: observedSpan,
                    notImplementedError: ''
                };
                Helpers.log(serverRole, 'observed span', Helpers.json2str(observedSpan));

                if (downstream) {
                    _this.callDownstream(serverRole, downstream, serverSpan).then(function (downstreamResponse) {
                        response.downstream = downstreamResponse;
                        Helpers.log(serverRole, 'returning response', Helpers.json2str(response));
                        resolve(response);
                    });
                } else {
                    Helpers.log(serverRole, 'returning response', Helpers.json2str(response));
                    resolve(response);
                }
            });
        }
    }, {
        key: 'callDownstream',
        value: function callDownstream(serverRole, downstream, serverSpan) {
            Helpers.log(serverRole, 'calling downstream', Helpers.json2str(downstream));
            var transport = downstream.transport;
            if (transport === constants.TRANSPORT_HTTP) {
                return this.callDownstreamHTTP(downstream, serverSpan);
            } else if (transport === constants.TRANSPORT_TCHANNEL) {
                return this.callDownstreamTChannel(downstream, serverSpan);
            } else if (transport == constants.TRANSPORT_DUMMY) {
                return new _rsvp2.default.Promise(function (resolve, reject) {
                    resolve({ 'notImplementedError': 'Dummy has not been implemented' });
                });
            } else {
                return new _rsvp2.default.Promise(function (resolve, reject) {
                    resolve({ 'notImplementedError': 'Unrecognized transport received: ' + transport });
                });
            }
        }
    }, {
        key: 'callDownstreamHTTP',
        value: function callDownstreamHTTP(downstream, serverSpan) {
            var _this2 = this;

            return new _rsvp2.default.Promise(function (resolve, reject) {

                var port = parseInt(downstream.port);
                var downstreamUrl = 'http://' + downstream.host + ':' + port + '/join_trace';

                var clientSpan = _this2._tracer.startSpan('client-span', { childOf: serverSpan.context() });
                var headers = { 'Content-Type': 'application/json' };
                _this2._tracer.inject(clientSpan.context(), _opentracing2.default.FORMAT_HTTP_HEADERS, headers);

                _request2.default.post({
                    'url': downstreamUrl,
                    'forever': true,
                    'headers': headers,
                    'body': JSON.stringify({
                        'serverRole': downstream.serverRole,
                        'downstream': downstream.downstream
                    })
                }, function (err, response) {
                    if (err) {
                        Helpers.log('error in downstream call:', err);
                        clientSpan.finish();
                        reject(err);
                        return;
                    }

                    clientSpan.finish();
                    var downstreamResponse = JSON.parse(response.body);
                    resolve(downstreamResponse);
                });
            });
        }
    }, {
        key: 'callDownstreamTChannel',
        value: function callDownstreamTChannel(downstream, serverSpan) {
            var _this3 = this;

            return new _rsvp2.default.Promise(function (resolve, reject) {
                var port = parseInt(downstream.port);
                var downstreamUrl = 'http://' + downstream.host + ':' + port + '/join_trace';

                var context = new _default_context2.default();
                context.setSpan(serverSpan);
                var request = _this3._tracedChannel.request({
                    timeout: 5000,
                    context: context,
                    headers: {
                        cn: 'tcollector-requestor'
                    },
                    trace: true,
                    serviceName: 'node',
                    retryFlags: { never: true }
                });
                var joinTraceRequest = {
                    'serverRole': downstream.serverRole
                };

                if (downstream.downstream) {
                    joinTraceRequest.downstream = downstream.downstream;
                }

                request.send('TracedService::joinTrace', null, { request: joinTraceRequest }, function (err, response) {
                    if (err) {
                        Helpers.log('tchannel err', err);
                        return;
                    }
                    resolve(response.body);
                });
            });
        }
    }, {
        key: 'observeSpan',
        value: function observeSpan(span) {
            var observed = {
                traceId: 'no span found',
                sampled: false,
                baggage: 'no span found'
            };

            if (span) {
                observed = {
                    traceId: span.context().traceIdStr || '',
                    sampled: span.context().isSampled(),
                    baggage: span.getBaggageItem(constants.BAGGAGE_KEY)
                };
            }
            return observed;
        }
    }], [{
        key: 'log',
        value: function log() {
            // $FlowIgnore - stop complaining about property `env` not found
            if (process.env.NODE_ENV !== 'test') {
                for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                    args[_key] = arguments[_key];
                }

                console.log.apply(null, args);
            }
        }
    }, {
        key: 'json2str',
        value: function json2str(json) {
            return JSON.stringify(json);
        }
    }]);

    return Helpers;
}();

exports.default = Helpers;
//# sourceMappingURL=helpers.js.map
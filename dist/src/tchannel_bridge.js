'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

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

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var _constants = require('./constants');

var constants = _interopRequireWildcard(_constants);

var _default_context = require('./default_context');

var _default_context2 = _interopRequireDefault(_default_context);

var _span = require('./span');

var _span2 = _interopRequireDefault(_span);

var _span_context = require('./span_context');

var _span_context2 = _interopRequireDefault(_span_context);

var _util = require('./util');

var _util2 = _interopRequireDefault(_util);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _tracer = require('./tracer');

var _tracer2 = _interopRequireDefault(_tracer);

var _text_map_codec = require('./propagators/text_map_codec');

var _text_map_codec2 = _interopRequireDefault(_text_map_codec);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TCHANNEL_TRACING_PREFIX = '$tracing$';

var TChannelBridge = function () {

    /**
     * @param {Object} [tracer] - Jaeger Tracer
     * @param {Object} [options] - options
     * @param {Function} [options.contextFactory] - function used to create new Context object instead of DefaultContext
     * @param {Function} [options.getSpan] - function(ctx): Span - used to read Span from Context object; default is ctx.getSpan()
     * @param {Function} [options.setSpan] - function(ctx, span): void - used to set Span on the Context object; default is ctx.setSpan(span)
     */
    function TChannelBridge(tracer) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        _classCallCheck(this, TChannelBridge);

        this._tracer = tracer;
        _assert2.default.equal('object', typeof options === 'undefined' ? 'undefined' : _typeof(options), 'options must be an object');
        this._codec = new _text_map_codec2.default({
            urlEncoding: false,
            contextKey: TCHANNEL_TRACING_PREFIX + constants.TRACER_STATE_HEADER_NAME,
            baggagePrefix: TCHANNEL_TRACING_PREFIX + constants.TRACER_BAGGAGE_HEADER_PREFIX
        });
        this._contextFactory = options.contextFactory || function () {
            return new _default_context2.default();
        };
        this._getSpan = options.getSpan || function (ctx) {
            return ctx.getSpan();
        };
        this._setSpan = options.setSpan || function (ctx, span) {
            return ctx.setSpan(span);
        };
    }

    _createClass(TChannelBridge, [{
        key: '_tchannelCallbackWrapper',
        value: function _tchannelCallbackWrapper(span, callback, err, res) {
            if (err) {
                span.setTag(_opentracing2.default.Tags.ERROR, true);
                span.log('error_msg', err);
            }

            span.finish();
            return callback(err, res);
        }

        /**
         * Wraps a tchannel handler, and takes a context in order to populate the incoming context
         * with a span.
         *
         * @param {Function} [handlerFunc] - a tchannel handler function that responds to an incoming request.
         * @param {Object} [options] - options to be passed to a span on creation.
         * @returns {Function} - a function that wrapps the handler in order to automatically populate
         * a the handler's context with a span.
         **/

    }, {
        key: 'tracedHandler',
        value: function tracedHandler(handlerFunc) {
            var _this = this;

            var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

            return function (perProcessOptions, request, headers, body, callback) {
                var context = _this._contextFactory();
                var operationName = options.operationName || request.arg1;
                var span = _this._extractSpan(operationName, headers);

                // set tags
                span.setTag(_opentracing2.default.Tags.PEER_SERVICE, request.callerName);
                var hostPort = request.remoteAddr.split(':');
                if (hostPort.length == 2) {
                    span.setTag(_opentracing2.default.Tags.PEER_PORT, parseInt(hostPort[1]));
                }
                if (request.headers && request.headers.as) {
                    span.setTag('as', request.headers.as);
                }

                _this._setSpan(context, span);

                // remove headers prefixed with $tracing$
                var headerKeys = Object.keys(headers);
                for (var i = 0; i < headerKeys.length; i++) {
                    var key = headerKeys[i];
                    if (headers.hasOwnProperty(key) && _util2.default.startsWith(key, TCHANNEL_TRACING_PREFIX)) {
                        delete headers[key];
                    }
                }

                var wrappingCallback = _this._tchannelCallbackWrapper.bind(null, span, callback);
                request.context = context;
                handlerFunc(perProcessOptions, request, headers, body, wrappingCallback);
            };
        }
    }, {
        key: '_wrapTChannelSend',
        value: function _wrapTChannelSend(wrappedSend, channel, req, endpoint, headers, body, callback) {
            headers = headers || {};
            var context = req.context || this._contextFactory();
            var childOf = this._getSpan(context);
            var clientSpan = this._tracer.startSpan(endpoint, {
                childOf: childOf // ok if null, will start a new trace
            });
            clientSpan.setTag(_opentracing2.default.Tags.PEER_SERVICE, req.serviceName);
            clientSpan.setTag(_opentracing2.default.Tags.SPAN_KIND, _opentracing2.default.Tags.SPAN_KIND_RPC_CLIENT);
            this.inject(clientSpan.context(), headers);

            // wrap callback so that span can be finished as soon as the response is received
            var wrappingCallback = this._tchannelCallbackWrapper.bind(null, clientSpan, callback);

            return wrappedSend.call(channel, req, endpoint, headers, body, wrappingCallback);
        }
    }, {
        key: '_wrapTChannelRequest',
        value: function _wrapTChannelRequest(channel, wrappedRequestMethod, requestOptions) {
            // We set the parent to a span with trace_id zero, so that tchannel's
            // outgoing tracing frame also has a trace id of zero.
            // This forces other tchannel implementations to rely on the headers for the trace context.
            requestOptions.parent = { span: TChannelBridge.makeFakeTChannelParentSpan() };

            var tchannelRequest = wrappedRequestMethod.call(channel, requestOptions);
            tchannelRequest.context = requestOptions.context;
            return tchannelRequest;
        }

        /**
         * Encode given span context as tchannel headers and store into the headers dictionary.
         * @param {Object} spanContext - Jaeger SpanContext.
         * @returns {Object} headers - a dictionary with TChannel application headers.
         */

    }, {
        key: 'inject',
        value: function inject(spanContext, headers) {
            this._codec.inject(spanContext, headers);
        }

        /**
         * A function that wraps a json, or thrift encoded channel, in order to populate
         * the outgoing headers with trace context, and baggage information.
         *
         * @param {Object} channel - the encoded channel to be wrapped for tracing.
         * @returns {Object} channel - the trace wrapped channel.
         * */

    }, {
        key: 'tracedChannel',
        value: function tracedChannel(channel) {
            var wrappedSend = channel.send;
            var wrappedRequestMethod = channel.channel.request;

            // We are patching the top level channel request method, not the encoded request method.
            channel.channel.request = this._wrapTChannelRequest.bind(this, channel.channel, wrappedRequestMethod);

            channel.send = this._wrapTChannelSend.bind(this, wrappedSend, channel);
            return channel;
        }
    }, {
        key: '_extractSpan',
        value: function _extractSpan(operationName, headers) {
            var traceContext = this._codec.extract(headers);
            var tags = {};
            tags[_opentracing2.default.Tags.SPAN_KIND] = _opentracing2.default.Tags.SPAN_KIND_RPC_SERVER;
            var options = {
                childOf: traceContext,
                tags: tags
            };
            var span = this._tracer.startSpan(operationName, options);
            return span;
        }
    }], [{
        key: 'makeFakeTChannelParentSpan',
        value: function makeFakeTChannelParentSpan() {
            return {
                id: [0, 0],
                traceid: [0, 0],
                parentid: [0, 0],
                flags: 0
            };
        }
    }]);

    return TChannelBridge;
}();

exports.default = TChannelBridge;
//# sourceMappingURL=tchannel_bridge.js.map
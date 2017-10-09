// @flow
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

import assert from 'assert';
import * as constants from './constants';
import DefaultContext from './default_context';
import Span from './span';
import SpanContext from './span_context';
import Utils from './util';
import opentracing from 'opentracing';
import Tracer from './tracer';
import TextMapCodec from './propagators/text_map_codec';

let TCHANNEL_TRACING_PREFIX = '$tracing$';

export default class TChannelBridge {
    _tracer: Tracer;
    _codec: TextMapCodec;
    _contextFactory: Function;
    _getSpan: Function;
    _setSpan: Function;

    /**
     * @param {Object} [tracer] - Jaeger Tracer
     * @param {Object} [options] - options
     * @param {Function} [options.contextFactory] - function used to create new Context object instead of DefaultContext
     * @param {Function} [options.getSpan] - function(ctx): Span - used to read Span from Context object; default is ctx.getSpan()
     * @param {Function} [options.setSpan] - function(ctx, span): void - used to set Span on the Context object; default is ctx.setSpan(span)
     */
    constructor(tracer: Tracer, options: any = {}) {
        this._tracer = tracer;
        assert.equal('object', typeof(options), 'options must be an object');
        this._codec = new TextMapCodec({
            urlEncoding: false,
            contextKey: TCHANNEL_TRACING_PREFIX + constants.TRACER_STATE_HEADER_NAME,
            baggagePrefix: TCHANNEL_TRACING_PREFIX + constants.TRACER_BAGGAGE_HEADER_PREFIX
        });
        this._contextFactory = options.contextFactory || function() { return new DefaultContext(); };
        this._getSpan = options.getSpan || function(ctx) { return ctx.getSpan(); };
        this._setSpan = options.setSpan || function(ctx, span) { return ctx.setSpan(span); };
    }

    _tchannelCallbackWrapper(span: Span, callback: Function, err: any, res: any) {
        if (err) {
            span.setTag(opentracing.Tags.ERROR, true);
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
    tracedHandler(handlerFunc: any, options: any = {}): Function {
        return (perProcessOptions, request, headers, body, callback) => {
            let context: Context = this._contextFactory();
            let operationName: string = options.operationName || request.arg1;
            let span: Span = this._extractSpan(operationName, headers);

            // set tags
            span.setTag(opentracing.Tags.PEER_SERVICE, request.callerName);
            let hostPort: Array<string> = request.remoteAddr.split(':');
            if (hostPort.length == 2) {
                span.setTag(opentracing.Tags.PEER_PORT, parseInt(hostPort[1]));
            }
            if (request.headers && request.headers.as) {
                span.setTag('as', request.headers.as);
            }

            this._setSpan(context, span);

            // remove headers prefixed with $tracing$
            let headerKeys: Array<string> = Object.keys(headers);
            for (let i = 0; i < headerKeys.length; i++) {
                let key = headerKeys[i];
                if (headers.hasOwnProperty(key) && Utils.startsWith(key, TCHANNEL_TRACING_PREFIX)) {
                    delete headers[key];
                }
            }

            let wrappingCallback: Function = this._tchannelCallbackWrapper.bind(null, span, callback);
            request.context = context;
            handlerFunc(perProcessOptions, request, headers, body, wrappingCallback);
        };
    }

    _wrapTChannelSend(wrappedSend: Function, channel: any, req: any, endpoint: string, headers: any, body: any, callback: Function) {
        headers = headers || {};
        let context: Context = req.context || this._contextFactory();
        let childOf: Span = this._getSpan(context);
        let clientSpan = this._tracer.startSpan(endpoint, {
            childOf: childOf // ok if null, will start a new trace
        });
        clientSpan.setTag(opentracing.Tags.PEER_SERVICE, req.serviceName);
        clientSpan.setTag(opentracing.Tags.SPAN_KIND, opentracing.Tags.SPAN_KIND_RPC_CLIENT);
        this.inject(clientSpan.context(), headers);

        // wrap callback so that span can be finished as soon as the response is received
        let wrappingCallback: Function = this._tchannelCallbackWrapper.bind(null, clientSpan, callback);

        return wrappedSend.call(channel, req, endpoint, headers, body, wrappingCallback);
    }

    _wrapTChannelRequest(channel: any, wrappedRequestMethod: any, requestOptions: any) {
        // We set the parent to a span with trace_id zero, so that tchannel's
        // outgoing tracing frame also has a trace id of zero.
        // This forces other tchannel implementations to rely on the headers for the trace context.
        requestOptions.parent = { span: TChannelBridge.makeFakeTChannelParentSpan() };

        let tchannelRequest: any = wrappedRequestMethod.call(channel, requestOptions);
        tchannelRequest.context = requestOptions.context;
        return tchannelRequest;
    }

    /**
     * Encode given span context as tchannel headers and store into the headers dictionary.
     * @param {Object} spanContext - Jaeger SpanContext.
     * @returns {Object} headers - a dictionary with TChannel application headers.
     */
    inject(spanContext: any, headers: any) {
        this._codec.inject(spanContext, headers);
    }

    /**
     * A function that wraps a json, or thrift encoded channel, in order to populate
     * the outgoing headers with trace context, and baggage information.
     *
     * @param {Object} channel - the encoded channel to be wrapped for tracing.
     * @returns {Object} channel - the trace wrapped channel.
     * */
    tracedChannel(channel: any): any {
        let wrappedSend = channel.send;
        let wrappedRequestMethod = channel.channel.request;

        // We are patching the top level channel request method, not the encoded request method.
        channel.channel.request = this._wrapTChannelRequest.bind(this, channel.channel, wrappedRequestMethod);

        channel.send = this._wrapTChannelSend.bind(this, wrappedSend, channel);
        return channel;
    }

    static makeFakeTChannelParentSpan(): any {
        return {
            id: [0, 0],
            traceid: [0, 0],
            parentid: [0, 0],
            flags: 0
        };
    }

    _extractSpan(operationName: string, headers: any): Span {
        let traceContext: ?SpanContext = this._codec.extract(headers);
        let tags: any = {};
        tags[opentracing.Tags.SPAN_KIND] = opentracing.Tags.SPAN_KIND_RPC_SERVER;
        let options: any = {
            childOf: traceContext,
            tags: tags
        }
        let span: Span = this._tracer.startSpan(operationName, options);
        return span;
    }
}

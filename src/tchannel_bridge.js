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

import * as constants from './constants';
import Span from './span';
import SpanContext from './span_context';
import Utils from './util';
import opentracing from 'opentracing';
import Tracer from '../src/tracer';
import TextMapCodec from '../src/propagators/text_map_codec';

let TCHANNEL_TRACING_PREFIX = '$tracing$';

export default class TChannelBridge {
    _tracer: Tracer;
    _codec: TextMapCodec;

    constructor(tracer: Tracer) {
        this._tracer = tracer;
        this._codec = new TextMapCodec({
            urlEncoding: false,
            contextKey: TCHANNEL_TRACING_PREFIX + constants.TRACER_STATE_HEADER_NAME,
            baggagePrefix: TCHANNEL_TRACING_PREFIX + constants.TRACER_BAGGAGE_HEADER_PREFIX
        });
    }

    _tchannelCallbackWrapper(span, wrappedCallback, err, res) {
        if (err) {
            span.setTag(opentracing.Tags.ERROR, true);
        }

        span.finish();
        return wrappedCallback(err, res);
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
    tracedHandler(handlerFunc: any, options: startSpanArgs = {}): Function {
        return (context, request, headers, body, wrappedCallback) => {
            let operationName = options.operationName || request.arg1;
            let span = this._extractSpan(operationName, headers);
            span.setTag(opentracing.Tags.SPAN_KIND, opentracing.Tags.SPAN_KIND_RPC_SERVER);
            span.setTag(opentracing.Tags.PEER_SERVICE, request.callerName);
            let hostPort = request.remoteAddr.split(':');
            span.setTag(opentracing.Tags.PEER_HOST_IPV4, Utils.ipToInt(hostPort[0]));
            span.setTag(opentracing.Tags.PEER_PORT, parseInt(hostPort[1]));
            if (request.headers && request.headers.as) {
                span.setTag('as', request.headers.as);
            }
            // In theory may overwrite tchannel span, but thats what we want anyway.
            context.openTracingSpan = span;

            // remove headers prefixed with $tracing$
            for (let key in headers) {
                if (headers.hasOwnProperty(key) && Utils.startsWith(key, TCHANNEL_TRACING_PREFIX)) {
                    delete headers[key];
                }
            }

            let callback = this._tchannelCallbackWrapper.bind(null, span, wrappedCallback);
            handlerFunc(context, request, headers, body, callback);
        };
    }

    _wrapTChannelSend(wrappedSend, channel, req, endpoint, headers, body, wrappedCallback) {
        headers = headers || {};
        let context = req.openTracingContext || {};
        // if opentracingContext.openTracingSpan is null, then start a new root span
        // else start a span that is the child of the context span.
        let childOf = context.openTracingSpan;
        context.openTracingSpan = this._tracer.startSpan(endpoint, {
            childOf: childOf
        });
        context.openTracingSpan.setTag(opentracing.Tags.PEER_SERVICE, req.serviceName);
        context.openTracingSpan.setTag(opentracing.Tags.SPAN_KIND, opentracing.Tags.SPAN_KIND_RPC_CLIENT);
        headers = this._injectSpan(context.openTracingSpan, headers);

        // wrap callback so that span can be finished as soon as the response is received
        let callback = this._tchannelCallbackWrapper.bind(null, context.openTracingSpan, wrappedCallback);

        return wrappedSend.call(channel, req, endpoint, headers, body, callback);
    };

    _wrapTChannelRequest(channel, wrappedRequest, requestOptions) {
        // We set the parent to a span with trace_id zero, so that tchannel's
        // outgoing tracing frame also has a trace id of zero.
        // This forces other tchannel implementations to rely on the headers for the trace context.
        requestOptions.parent = { span: this._getTChannelParentSpan() };

        let tchannelRequest = wrappedRequest.call(channel, requestOptions);
        tchannelRequest.openTracingContext = requestOptions.openTracingContext;
        return tchannelRequest;
    }

    /**
     * A function that wraps a json, or thrift encoded channel, in order to populate
     * the outgoing headers with trace context, and baggage information.
     *
     * @param {Object} channel - the encoded channel to be wrapped for tracing.
     * @param {Object} context - A context that contains the outgoing span to be seralized.  If the context does not contain a span then a new root span is created.
     * @returns {Object} channel - the trace wrapped channel.
     * */
    tracedChannel(channel: any): any {
        let wrappedSend = channel.send;
        let wrappedRequest = channel.channel.request;

        // We are patching the top level channel request method, not the encoded request method.
        channel.channel.request = this._wrapTChannelRequest.bind(this, channel.channel, wrappedRequest);

        channel.send = this._wrapTChannelSend.bind(this, wrappedSend, channel);
        return channel;
    }

    _getTChannelParentSpan(): TChannelSpan {
        return {
            id: [0, 0],
            traceid: [0, 0],
            parentid: [0, 0],
            flags: 0
        };
    }

    _extractSpan(operationName: string, headers: any): Span {
        let traceContext: ?SpanContext = this._codec.extract(headers);
        let options = {
            childOf: traceContext
        }
        let span = this._tracer.startSpan(operationName, options);
        return span;
    }

    _injectSpan(span: Span, carrier: any): any {
        this._codec.inject(span.context(), carrier);
        return carrier;
    }
}

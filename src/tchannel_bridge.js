// @flow
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
import Tracer from '../src/tracer';
import TextMapCodec from '../src/propagators/text_map_codec';

export default class TChannelBridge {
    _tracer: Tracer;
    _codec: TextMapCodec;

    constructor(tracer: Tracer) {
        this._tracer = tracer;
        this._codec = new TextMapCodec({
            urlEncoding: false,
            contextKey: constants.TCHANNEL_TRACING_PREFIX + constants.TRACER_STATE_HEADER_NAME,
            baggagePrefix: constants.TCHANNEL_TRACING_PREFIX + constants.TRACER_BAGGAGE_HEADER_PREFIX
        });
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
        return (context, request, headers, body, callback) => {
            let operationName = request.arg1 || options.operationName;
            let span = this._getSpanFromTChannelRequest(operationName, headers);
            // In theory may overwrite tchannel span, but thats what we want anyway.
            context.span = span;
            handlerFunc(context, request, headers, body, callback);
        };
    }

    /**
     * A function that wraps a json, or thrift encoded channel, in order to populate
     * the outgoing headers with trace context, and baggage information.
     *
     * @param {Object} channel - the encoded channel to be wrapped for tracing.
     * @param {Object} context - A context that contains the outgoing span to be seralized.  If the context does not contain a span then a new root span is created.
     * @returns {Object} channel - the trace wrapped channel.
     * */
    tracedChannel(channel: any, context: any = {}): any {
        let wrappedRequestFunc = channel.request.bind(channel);
        channel.request = (requestOptions) => {
            requestOptions.parent = { span: this._getTChannelParentSpan() };
            let channelRequest = wrappedRequestFunc(requestOptions);
            let wrappedSend = channelRequest.send.bind(channelRequest);
            channelRequest.send = (endpoint, headers = {}, body, callback) => {
                if (!context.span) {
                    context.span = this._tracer.startSpan(endpoint);
                }
                this._saveSpanStateToCarrier(context.span, headers);
                return wrappedSend(endpoint, headers, body, callback);
            };

            return channelRequest;
        };

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

    _getSpanFromTChannelRequest(operationName: string, headers: any = {}, options: any = {}): Span {
        let traceContext: ?SpanContext = this._codec.extract(headers);
        options.childOf = traceContext;
        let span = this._tracer.startSpan(operationName, options);
        return span;
    }

    _saveSpanStateToCarrier(span: Span, carrier: any = {}): any {
        this._codec.inject(span.context(), carrier);
        return carrier;
    }
}

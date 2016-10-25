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

import * as crossdock_constants from '../crossdock/src/constants';
import * as constants from './constants';
import Int64 from 'node-int64';
import Span from './span';
import SpanContext from './span_context';
import Utils from './util';
import tchannelSpan from './vendor/tchannel/span';
import Tracer from '../src/tracer';

export default class TChannelBridge {
    static toTChannelSpan(span: Span): TChannelSpan {
        return new tchannelSpan({
            id: Utils.tchannelBufferToIntId(span.context().spanId),
            traceid: Utils.tchannelBufferToIntId(span.context().traceId),
            name: span.name,
            parentid: Utils.tchannelBufferToIntId(span.context().parentId),
            flags: span.context().flags || 0
        });
    }

    static toTChannelv2Span(span: Span): TChannelSpan {
        return new tchannelSpan({
            id: span.context().spanId,
            traceid: span.context().traceId,
            name: span.name,
            parentid: span.context().parentId,
            flags: span.context().flags || 0
        });
    }

    static getSpanFromTChannelRequest(tracer: Tracer, request: any, headers: any = {}, options: any = {}): Span {
        let traceContext;
        if (crossdock_constants.TCHANNEL_HEADER_TRACER_STATE_KEY in headers) {
            traceContext = SpanContext.fromString(headers[`${crossdock_constants.TCHANNEL_HEADER_TRACER_STATE_KEY}`]);
        } else if (request.span) {
            traceContext = new SpanContext();
            if (Buffer.isBuffer(request.span.id)) {
                traceContext.spanId = request.span.id;
                traceContext.traceId = request.span.traceid;
                traceContext.parentId = request.span.parentid;
                traceContext.flags = request.span.flags;
            } else {
                traceContext.spanId = new Int64(request.span.id[0], request.span.id[1]).toBuffer();
                traceContext.traceId = new Int64(request.span.traceid[0], request.span.traceid[1]).toBuffer();
                traceContext.parentId = new Int64(request.span.parentid[0], request.span.parentid[1]).toBuffer();
                traceContext.flags = request.span.flags;
            }
        }

        options.childOf = traceContext;
        let span = tracer.startSpan(String(request.arg1), options);

        for (let key in headers) {
            let keyWithoutTChannelPrefix = key;
            if (Utils.startsWith(key, crossdock_constants.TCHANNEL_TRACING_PREFIX)) {
                keyWithoutTChannelPrefix = key.substring(crossdock_constants.TCHANNEL_TRACING_PREFIX.length);
            }

            if (Utils.startsWith(keyWithoutTChannelPrefix, constants.TRACER_BAGGAGE_HEADER_PREFIX)) {
                let baggageKey = keyWithoutTChannelPrefix.substring(constants.TRACER_BAGGAGE_HEADER_PREFIX.length);
                let baggageValue = headers[key];
                span.setBaggageItem(baggageKey, baggageValue);
            }
        }

        return span;
    }

    static saveBaggageToCarrier(span: Span, carrier: any = {}): any {
        let baggage = span.context().baggage;
        for (let key in baggage) {
            if (baggage.hasOwnProperty(key)) {
                let baggageKey = `${constants.TRACER_BAGGAGE_HEADER_PREFIX}${key}`;
                let baggageValue = baggage[key];
                carrier[baggageKey] = baggageValue;
            }
        }

        return carrier;
    }
}

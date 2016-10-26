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

let TCHANNEL_TRACER_STATE = constants.TCHANNEL_TRACING_PREFIX + constants.TRACER_STATE_HEADER_NAME;
export default class TChannelBridge {
    static getSpanFromTChannelRequest(tracer: Tracer, operationName: string, headers: any = {}, options: any = {}): Span {
        let traceContext;
        if (headers.hasOwnProperty(TCHANNEL_TRACER_STATE)) {
            traceContext = SpanContext.fromString(headers[constants.TCHANNEL_TRACING_PREFIX + constants.TRACER_STATE_HEADER_NAME]);
        }

        options.childOf = traceContext;
        let span = tracer.startSpan(operationName, options);

        for (let key in headers) {
            let keyWithoutTChannelPrefix = key;
            if (Utils.startsWith(key, constants.TCHANNEL_TRACING_PREFIX)) {
                keyWithoutTChannelPrefix = key.substring(constants.TCHANNEL_TRACING_PREFIX.length);
            }

            if (Utils.startsWith(keyWithoutTChannelPrefix, constants.TRACER_BAGGAGE_HEADER_PREFIX)) {
                let baggageKey = keyWithoutTChannelPrefix.substring(constants.TRACER_BAGGAGE_HEADER_PREFIX.length);
                let baggageValue = headers[key];
                span.setBaggageItem(baggageKey, baggageValue);
            }
        }

        return span;
    }

    static saveTracerStateToCarrier(span: Span, carrier: any = {}) {
        carrier[TCHANNEL_TRACER_STATE] = span.context().toString();
        return carrier;
    }

    static saveBaggageToCarrier(span: Span, carrier: any = {}): any {
        let baggage = span.context().baggage;

        for (let key in baggage) {
            if (baggage.hasOwnProperty(key)) {
                let baggageKey = constants.TRACER_BAGGAGE_HEADER_PREFIX + key;
                let baggageValue = baggage[key];
                carrier[baggageKey] = baggageValue;
            }
        }

        return carrier;
    }
}

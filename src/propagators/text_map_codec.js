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

import * as constants from '../constants.js';
import Metrics from '../metrics/metrics.js';
import NoopMetricFactory from '../metrics/noop/metric_factory';
import SpanContext from '../span_context.js';
import Utils from '../util.js';

let TRACER_STATE_HEADER_NAME = 'uber-trace-id';
let TRACER_BAGGAGE_HEADER_PREFIX = 'uberctx-';

export default class TextMapCodec {
    _urlEncoding: boolean;
    _contextKey: string;
    _baggagePrefix: string;
    _metrics: any;

    constructor(options: any = {}) {
        this._urlEncoding = !!options.urlEncoding;
        this._contextKey = options.contextKey || TRACER_STATE_HEADER_NAME;
        this._contextKey = this._contextKey.toLowerCase();
        this._baggagePrefix = options.baggagePrefix || TRACER_BAGGAGE_HEADER_PREFIX;
        this._baggagePrefix = this._baggagePrefix.toLowerCase();
        this._metrics = options.metrics || new Metrics(new NoopMetricFactory());
    }

    _encodedValue(value: string): string {
        if (this._urlEncoding) {
            return encodeURIComponent(value);
        }

        return value;
    }

    _decodedValue(value: string): string {
        if (this._urlEncoding) {
            return decodeURIComponent(value);
        }

        return value;
    }

    extract(carrier: any): ?SpanContext {
        // $FlowIgnore - I just want an empty span context.
        let spanContext = new SpanContext();
        let baggage = {};
        let debugId;

        for (let key in carrier) {
            if (carrier.hasOwnProperty(key)) {
                let lowerKey = key.toLowerCase();
                if (lowerKey === this._contextKey) {
                    let decodedContext = SpanContext.fromString(this._decodedValue(carrier[key]));
                    if (decodedContext === null) {
                        this._metrics.decodingErrors.increment(1);
                    } else {
                        spanContext = decodedContext;
                    }
                }

                if (lowerKey === constants.JAEGER_DEBUG_HEADER) {
                    debugId = this._decodedValue(carrier[key]);
                }

                if (Utils.startsWith(lowerKey, this._baggagePrefix)) {
                    let keyWithoutPrefix = key.substring(this._baggagePrefix.length);
                    baggage[keyWithoutPrefix] = this._decodedValue(carrier[key]);
                }
            }
        }

        spanContext.debugId = debugId;
        spanContext.baggage = baggage;
        return spanContext;
    }

    inject(spanContext: SpanContext, carrier: any): void {
        let stringSpanContext = spanContext.toString();
        carrier[this._contextKey] = this._encodedValue(stringSpanContext);

        let baggage = spanContext.baggage;
        for (let key in baggage) {
            if (baggage.hasOwnProperty(key)) {
                let value = this._encodedValue(spanContext.baggage[key]);
                carrier[`${this._baggagePrefix}${key}`] = value;
            }
        }
    }
}

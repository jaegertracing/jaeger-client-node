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

const ZIPKIN_PARENTSPAN_HEADER = 'x-b3-parentspanid';
const ZIPKIN_SPAN_HEADER = 'x-b3-spanid';
const ZIPKIN_TRACE_HEADER = 'x-b3-traceid';
const ZIPKIN_SAMPLED_HEADER = 'x-b3-sampled';
const ZIPKIN_DEBUG_HEADER = 'x-b3-flags';

export default class ZipkinB3TextMapCodec {
    _urlEncoding: boolean;
    _baggagePrefix: string;
    _metrics: any;

    constructor(options: any = {}) {
        this._urlEncoding = !!options.urlEncoding;
        this._baggagePrefix = options.baggagePrefix || constants.TRACER_BAGGAGE_HEADER_PREFIX;
        this._baggagePrefix = this._baggagePrefix.toLowerCase();
        this._metrics = options.metrics || new Metrics(new NoopMetricFactory());
    }

    _encodeValue(value: string): string {
        if (this._urlEncoding) {
            return encodeURIComponent(value);
        }

        return value;
    }

    _decodeValue(value: string): string {
        // only use url-decoding if there are meta-characters '%'
        if (this._urlEncoding && value.indexOf('%') > -1) {
            return this._decodeURIValue(value);
        }

        return value;
    }

    _decodeURIValue(value: string): string {
        // unfortunately, decodeURIComponent() can throw 'URIError: URI malformed' on bad strings
        try {
            return decodeURIComponent(value);
        } catch (e) {
            return value;
        }
    }

    extract(carrier: any): ?SpanContext {
        let spanContext = new SpanContext();
        let baggage = {};

        for (let key in carrier) {
            if (carrier.hasOwnProperty(key)) {
                let lowerKey = key.toLowerCase();

                switch (lowerKey) {
                    case ZIPKIN_PARENTSPAN_HEADER:
                        spanContext.parentId = this._decodeValue(carrier[ZIPKIN_PARENTSPAN_HEADER]);
                        break;
                    case ZIPKIN_SPAN_HEADER:
                        spanContext.spanId = this._decodeValue(carrier[ZIPKIN_SPAN_HEADER]);
                        break;
                    case ZIPKIN_TRACE_HEADER:
                        spanContext.traceId = this._decodeValue(carrier[ZIPKIN_TRACE_HEADER]);
                        break;
                    case ZIPKIN_SAMPLED_HEADER:
                        spanContext.flags = spanContext.flags | constants.SAMPLED_MASK;
                        break;
                    case ZIPKIN_DEBUG_HEADER:
                        // "debug implies sampled"
                        // https://github.com/openzipkin/b3-propagation
                        spanContext.flags = spanContext.flags | constants.SAMPLED_MASK | constants.DEBUG_MASK;
                        break;
                    case constants.JAEGER_DEBUG_HEADER:
                        spanContext.debugId = this._decodeValue(carrier[constants.JAEGER_DEBUG_HEADER]);
                        break;
                    case constants.JAEGER_BAGGAGE_HEADER:
                        this._parseCommaSeparatedBaggage(baggage, this._decodeValue(carrier[key]));
                        break;
                    default:
                        if (Utils.startsWith(lowerKey, this._baggagePrefix)) {
                            let keyWithoutPrefix = key.substring(this._baggagePrefix.length);
                            baggage[keyWithoutPrefix] = this._decodeValue(carrier[key]);
                        }
                }
            }
        }

        spanContext.baggage = baggage;
        return spanContext;
    }

    inject(spanContext: SpanContext, carrier: any): void {
        carrier[ZIPKIN_TRACE_HEADER] = spanContext.traceIdStr;
        carrier[ZIPKIN_PARENTSPAN_HEADER] = spanContext.parentIdStr;
        carrier[ZIPKIN_SPAN_HEADER] = spanContext.spanIdStr;

        // > Since Debug implies Sampled, so don't also send "X-B3-Sampled: 1"
        // https://github.com/openzipkin/b3-propagation

        if (spanContext.isDebug()) {
           carrier[ZIPKIN_DEBUG_HEADER] = '1';
        } else {
            if (spanContext.isSampled()) {
                carrier[ZIPKIN_SAMPLED_HEADER] = '1';
            } else {
                carrier[ZIPKIN_SAMPLED_HEADER] = '0';
            }
        }

        let baggage = spanContext.baggage;
        for (let key in baggage) {
            if (baggage.hasOwnProperty(key)) {
                let value = this._encodeValue(spanContext.baggage[key]);
                carrier[`${this._baggagePrefix}${key}`] = value;
            }
        }
    }

    // Parse comma separated key=value pair list and add to baggage.
    // E.g. "key1=value1, key2=value2, key3 = value3"
    // is converted to map[string]string { "key1" : "value1",
    //                                     "key2" : "value2",
    //                                     "key3" : "value3" }
    _parseCommaSeparatedBaggage(baggage: any, values: string): void {
        values.split(',').forEach((keyVal) => {
            let splitKeyVal: Array<string> = keyVal.trim().split('=');
            if (splitKeyVal.length == 2) {
                baggage[splitKeyVal[0]] = splitKeyVal[1];
            }
        });
    }
}

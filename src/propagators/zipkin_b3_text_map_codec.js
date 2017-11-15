// @flow
// Copyright (c) 2017 The Jaeger Authors
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

import * as constants from '../constants.js';
import Metrics from '../metrics/metrics.js';
import NoopMetricFactory from '../metrics/noop/metric_factory';
import SpanContext from '../span_context.js';
import Utils from '../util.js';

const ZIPKIN_PARENTSPAN_HEADER = 'x-b3-parentspanid';
const ZIPKIN_SPAN_HEADER = 'x-b3-spanid';
const ZIPKIN_TRACE_HEADER = 'x-b3-traceid';
const ZIPKIN_SAMPLED_HEADER = 'x-b3-sampled';
const ZIPKIN_FLAGS_HEADER = 'x-b3-flags';

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
                    case ZIPKIN_FLAGS_HEADER:
                        // Per https://github.com/openzipkin/b3-propagation
                        //   "Debug is encoded as X-B3-Flags: 1"
                        // and
                        //   "Debug implies Sampled."
                        if (carrier[key] === '1') {
                            spanContext.flags = spanContext.flags | constants.SAMPLED_MASK | constants.DEBUG_MASK;
                        }
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


        if (spanContext.isDebug()) {
           carrier[ZIPKIN_FLAGS_HEADER] = '1';
        } else {
            // Only set the zipkin sampled header if we're NOT using debug.
            // Per https://github.com/openzipkin/b3-propagation
            //   "Since Debug implies Sampled, so don't also send "X-B3-Sampled: 1"
            carrier[ZIPKIN_SAMPLED_HEADER] = spanContext.isSampled() ? '1' : '0';
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

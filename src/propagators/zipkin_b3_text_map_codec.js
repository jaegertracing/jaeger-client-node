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
import { parseCommaSeparatedBaggage } from '../propagators/baggage';

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

    _isValidZipkinId(value: string): boolean {
        // Validates a zipkin trace/spanID by attempting to parse it as a
        // string of hex digits. This "validation" is not entirely rigorous,
        // but equivalent to what is performed in the TextMapCodec.
        //
        // Note: due to the way parseInt works, this does not guarantee that
        // the string is composed *entirely* of hex digits.
        //
        // > If parseInt encounters a character that is not a numeral in the
        // > specified radix, it ignores it and all succeeding characters and
        // > returns the integer value parsed up to that point.
        //
        // Note: The Number type in JS cannot represent the full range of 64bit
        // unsigned ints, so using parseInt() on strings representing 64bit hex
        // numbers only returns an approximation of the actual value.
        // Fortunately, we do not depend on the returned value, we are only
        // using it to validate that the string is a valid hex number (which is
        // faster than doing it manually).  We cannot use
        // Int64(numberValue).toBuffer() because it throws exceptions on bad
        // strings.
        if (!value) {
            return true
        }

        return !isNaN(parseInt(value, 16));
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
        let baggage = {};
        let flags = 0;
        let debugId = '';
        let parentId = '';
        let spanId = '';
        let traceId = '';

        for (let key in carrier) {
            if (carrier.hasOwnProperty(key)) {
                let lowerKey = key.toLowerCase();

                switch (lowerKey) {
                    case ZIPKIN_PARENTSPAN_HEADER:
                        parentId = this._decodeValue(carrier[ZIPKIN_PARENTSPAN_HEADER]);
                        break;
                    case ZIPKIN_SPAN_HEADER:
                        spanId = this._decodeValue(carrier[ZIPKIN_SPAN_HEADER]);
                        break;
                    case ZIPKIN_TRACE_HEADER:
                        traceId = this._decodeValue(carrier[ZIPKIN_TRACE_HEADER]);
                        break;
                    case ZIPKIN_SAMPLED_HEADER:
                        flags = flags | constants.SAMPLED_MASK;
                        break;
                    case ZIPKIN_FLAGS_HEADER:
                        // Per https://github.com/openzipkin/b3-propagation
                        //   "Debug is encoded as X-B3-Flags: 1"
                        // and
                        //   "Debug implies Sampled."
                        if (carrier[key] === '1') {
                            flags = flags | constants.SAMPLED_MASK | constants.DEBUG_MASK;
                        }
                        break;
                    case constants.JAEGER_DEBUG_HEADER:
                        debugId = this._decodeValue(carrier[constants.JAEGER_DEBUG_HEADER]);
                        break;
                    case constants.JAEGER_BAGGAGE_HEADER:
                        parseCommaSeparatedBaggage(baggage, this._decodeValue(carrier[key]));
                        break;
                    default:
                        if (Utils.startsWith(lowerKey, this._baggagePrefix)) {
                            let keyWithoutPrefix = key.substring(this._baggagePrefix.length);
                            baggage[keyWithoutPrefix] = this._decodeValue(carrier[key]);
                        }
                }
            }
        }

        if ((!this._isValidZipkinId(traceId)) ||
            (!this._isValidZipkinId(spanId)) ||
            (!this._isValidZipkinId(parentId))) {
                // Use a context devoid of trace/span/parentSpan IDs (to be
                // consistent with the default codec behavior), and increment a
                // metric
                traceId = spanId = parentId = '';
                this._metrics.decodingErrors.increment(1);
            }

        return SpanContext.withStringIds(traceId, spanId, parentId, flags, baggage, debugId);
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
}

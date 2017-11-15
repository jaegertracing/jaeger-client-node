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

import * as constants from '../constants.js';
import Metrics from '../metrics/metrics.js';
import NoopMetricFactory from '../metrics/noop/metric_factory';
import SpanContext from '../span_context.js';
import Utils from '../util.js';
import { parseCommaSeparatedBaggage } from '../propagators/baggage';

export default class TextMapCodec {
    _urlEncoding: boolean;
    _contextKey: string;
    _baggagePrefix: string;
    _metrics: any;

    constructor(options: any = {}) {
        this._urlEncoding = !!options.urlEncoding;
        this._contextKey = options.contextKey || constants.TRACER_STATE_HEADER_NAME;
        this._contextKey = this._contextKey.toLowerCase();
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
        let debugId = '';

        for (let key in carrier) {
            if (carrier.hasOwnProperty(key)) {
                let lowerKey = key.toLowerCase();
                if (lowerKey === this._contextKey) {
                    let decodedContext = SpanContext.fromString(this._decodeValue(carrier[key]));
                    if (decodedContext === null) {
                        this._metrics.decodingErrors.increment(1);
                    } else {
                        spanContext = decodedContext;
                    }
                } else if (lowerKey === constants.JAEGER_DEBUG_HEADER) {
                    debugId = this._decodeValue(carrier[key]);
                } else if (lowerKey === constants.JAEGER_BAGGAGE_HEADER) {
                    parseCommaSeparatedBaggage(baggage, this._decodeValue(carrier[key]));
                } else if (Utils.startsWith(lowerKey, this._baggagePrefix)) {
                    let keyWithoutPrefix = key.substring(this._baggagePrefix.length);
                    baggage[keyWithoutPrefix] = this._decodeValue(carrier[key]);
                }
            }
        }

        spanContext.debugId = debugId;
        spanContext.baggage = baggage;
        return spanContext;
    }

    inject(spanContext: SpanContext, carrier: any): void {
        let stringSpanContext = spanContext.toString();
        carrier[this._contextKey] = stringSpanContext; // no need to encode this

        let baggage = spanContext.baggage;
        for (let key in baggage) {
            if (baggage.hasOwnProperty(key)) {
                let value = this._encodeValue(spanContext.baggage[key]);
                carrier[`${this._baggagePrefix}${key}`] = value;
            }
        }
    }
}

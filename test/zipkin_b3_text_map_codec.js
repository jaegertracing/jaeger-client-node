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

import {assert} from 'chai';
import * as constants from '../src/constants.js';
import ConstSampler from '../src/samplers/const_sampler.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import opentracing from 'opentracing';
import Tracer from '../src/tracer.js';
import Metrics from '../src/metrics/metrics.js';
import LocalMetricFactory from './lib/metrics/local/metric_factory.js';
import LocalBackend from './lib/metrics/local/backend.js';
import SpanContext from '../src/span_context.js';
import ZipkinB3TextMapCodec from '../src/propagators/zipkin_b3_text_map_codec.js';

describe('Zipkin B3 Text Map Codec should', () => {

    let tracer, codec, metrics;

    beforeEach(() => {
        metrics = new Metrics(new LocalMetricFactory());
        tracer = new Tracer(
            'test-tracer',
            new InMemoryReporter(),
            new ConstSampler(false), {
                metrics: metrics
            }
        );

        codec = new ZipkinB3TextMapCodec({
            urlEncoding: true,
            metrics: metrics,
        });

        tracer.registerInjector(opentracing.FORMAT_HTTP_HEADERS, codec);
        tracer.registerExtractor(opentracing.FORMAT_HTTP_HEADERS, codec);
    });

    afterEach(() => {
        tracer.close();
    });

    it ('report a metric when failing to decode tracer state', () => {
        let headers = {
            'x-b3-traceid': 'zzz-bad-value'
        };

        let context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);

        assert.isOk(context);
        assert.isOk(LocalBackend.counterEquals(metrics.decodingErrors, 1));
    });

    it ('set debug flag when debug-id-header is received', () => {
        let headers = {};
        headers[constants.JAEGER_DEBUG_HEADER] = encodeURIComponent('value1');

        let context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);
        assert.equal(context.debugId, 'value1');
    });

    it ('return a context devoid of trace/span ids if invalid ids are encountered in the headers', () => {

        let testCases = [
            {
                'x-b3-traceid': 'zzzzzz',
                'x-b3-spanid': '123abc',
                'x-b3-parentspanid': '456def'
            },
            {
                'x-b3-traceid': '123abc',
                'x-b3-spanid': 'zzzzzz',
                'x-b3-parentspanid': '456def'
            },
            {
                'x-b3-traceid': '123abc',
                'x-b3-spanid': '456def',
                'x-b3-parentspanid': 'zzzzz'
            }
        ];

        testCases.forEach((testCase) => {
            let context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, testCase);

            assert.isOk(context);
            assert.isNotOk(context.spanIdStr);
            assert.isNotOk(context.traceIdStr);
            assert.isNotOk(context.parentIdStr);
        });
    });

    it ('set the sampled flag when the zipkin sampled header is received', () => {
        let headers = {
            'x-b3-sampled': '1'
        };

        let context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);
        assert.isOk(context.isSampled());
        assert.isNotOk(context.isDebug());
    });

    it ('set the debug and sampled flags when the zipkin flags header is received', () => {
        let headers = {
            'x-b3-flags': '1'
        };

        let context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);
        assert.isOk(context.isSampled());
        assert.isOk(context.isDebug());

        headers = {
            'x-b3-flags': '0'
        };

        context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);
        assert.isNotOk(context.isSampled());
        assert.isNotOk(context.isDebug());
    });

    it ('should set the sampled header to "0" if not sampling', () => {
        let headers = {};

        let ctx = SpanContext.withStringIds('some-trace', 'some-span', 'some-parent');
        codec.inject(ctx, headers);

        assert.isUndefined(headers['x-b3-flags']);
        assert.equal(headers['x-b3-sampled'], '0');
    });

    it ('should set the sampled header to "1" if sampling', () => {
        let headers = {};

        let ctx = SpanContext.withStringIds('a', 'b', 'c');
        ctx.flags = constants.SAMPLED_MASK;

        codec.inject(ctx, headers);

        assert.isUndefined(headers['x-b3-flags']);
        assert.equal(headers['x-b3-sampled'], '1');
    });

    it ('should not send the sampled header if debug', () => {
        let headers = {};

        let ctx = SpanContext.withStringIds('some-trace', 'some-span', 'some-parent');
        ctx.flags = constants.DEBUG_MASK

        codec.inject(ctx, headers);

        assert.equal(headers['x-b3-flags'], '1');
        // > Since Debug implies Sampled, so don't also send "X-B3-Sampled: 1"
        // https://github.com/openzipkin/b3-propagation
        assert.isUndefined(headers['x-b3-sampled']);
    });

    it ('supports the use of the baggage headers', () => {
        let headers = {};
        headers[constants.TRACER_BAGGAGE_HEADER_PREFIX + 'a-key'] = 'a-value';
        headers[constants.JAEGER_BAGGAGE_HEADER] = 'some-key=some-value, another-key=another-value';

        let context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);
        assert.equal(context.baggage['a-key'], 'a-value');
        assert.equal(context.baggage['some-key'], 'some-value');
        assert.equal(context.baggage['another-key'], 'another-value');
    });
});

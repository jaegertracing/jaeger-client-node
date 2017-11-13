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

    let tracer, codec;

    beforeEach(() => {
        let metrics = new Metrics(new LocalMetricFactory());
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

    it ('set the sampled flag when the zipkin sampled header is received', () => {
        let headers = {
            'x-b3-sampled': '1'
        };

        let context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);
        assert.isOk(context.isSampled());
        assert.isNotOk(context.isDebug());
    });

    it ('set the debug and sampled flags with the zipkin flags header is recieved', () => {
        let headers = {
            'x-b3-flags': '1'
        };

        let context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);
        assert.isOk(context.isSampled());
        assert.isOk(context.isDebug());
    });

    it ('should set the sampled header to "1" if sampling', () => {
        let headers = {};

        let ctx = SpanContext.withStringIds('some-trace', 'some-span', 'some-parent');
        codec.inject(ctx, headers);

        assert.isUndefined(headers['x-b3-flags']);
        assert.equal(headers['x-b3-sampled'], '0');
    });

    it ('should set the sampled header to "1" if sampling', () => {
        let headers = {};

        let ctx = SpanContext.withStringIds('some-trace', 'some-span', 'some-parent');
        ctx.flags = constants.SAMPLED_MASK;

        codec.inject(ctx, headers);

        assert.isUndefined(headers['x-b3-flags']);
        assert.isOk(headers['x-b3-sampled']);
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

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

import {assert} from 'chai';
import * as constants from '../src/constants.js';
import ConstSampler from '../src/samplers/const_sampler.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import opentracing from 'opentracing';
import Tracer from '../src/tracer.js';
import Metrics from '../src/metrics/metrics.js';
import LocalMetricFactory from './lib/metrics/local/metric_factory.js';
import LocalBackend from './lib/metrics/local/backend.js';

describe('Text Map Codec should', () => {
    it ('report metric when failing to decode tracer state', () => {
        let metrics = new Metrics(new LocalMetricFactory());
        let tracer = new Tracer(
            'test-tracer',
            new InMemoryReporter(),
            new ConstSampler(false), {
                metrics: metrics
            }
        );

        let headers = {
            'uber-trace-id': 'bad-value'
        };
        let context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);

        assert.isOk(context);
        assert.isOk(LocalBackend.counterEquals(metrics.decodingErrors, 1));
    });

    it ('set debug flag when debug-id-header is received', () => {
        let metrics = new Metrics(new LocalMetricFactory());
        let tracer = new Tracer(
            'test-tracer',
            new InMemoryReporter(),
            new ConstSampler(false), {
                metrics: metrics
            }
        );
        let headers = {};
        headers[constants.JAEGER_DEBUG_HEADER] = encodeURIComponent('value1');

        let context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);
        assert.isOk(context.isDebugIDContainerOnly());
        assert.equal(context.debugId, 'value1');

        let span = tracer.startSpan("root", { childOf: context });

        assert.isNotOk(span.context().parentId);
        assert.isOk(span.context().traceId !== 0);
        assert.isOk(span.context().isSampled());
        assert.isOk(span.context().isDebug());

        let tagFound = false;
        for (let i = 0; i < span._tags.length; i++) {
            let tag = span._tags[i];
            if (tag.key === constants.JAEGER_DEBUG_HEADER && span._tags[i].value === 'value1') {
                tagFound = true;
            }
        }

        assert.isOk(tagFound);

        // metrics
        assert.isOk(LocalBackend.counterEquals(metrics.tracesStartedSampled, 1));
    });
});

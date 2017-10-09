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

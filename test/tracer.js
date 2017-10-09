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

import _ from 'lodash';
import {assert, expect} from 'chai';
import ConstSampler from '../src/samplers/const_sampler.js';
import * as constants from '../src/constants.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import * as opentracing from 'opentracing';
import {Tags as opentracing_tags} from 'opentracing';
import SpanContext from '../src/span_context.js';
import Tracer from '../src/tracer.js';
import Utils from '../src/util.js';
import Metrics from '../src/metrics/metrics.js';
import LocalMetricFactory from './lib/metrics/local/metric_factory.js';
import LocalBackend from './lib/metrics/local/backend.js';

describe('tracer should', () => {
    let tracer;
    let reporter = new InMemoryReporter();

    beforeEach(() => {
        tracer = new Tracer(
            'test-service-name',
            reporter,
            new ConstSampler(true)
        );
    });

    afterEach(() => {
        reporter.clear();
        tracer.close();
    });

    it ('begin a new span given only baggage headers', () => {
        // Users sometimes want to pass baggage even if there is no span.
        // In this case we must ensure a new root span is created.
        let headers = {};
        // combine normal baggage encoding
        headers[constants.TRACER_BAGGAGE_HEADER_PREFIX + 'robot'] = 'Bender';
        // with custom encoding via `jaeger-baggage` header
        headers[constants.JAEGER_BAGGAGE_HEADER] = 'male=Fry, female=Leela, Lord Nibbler';
        let spanContext = tracer.extract(opentracing.FORMAT_TEXT_MAP, headers);
        let rootSpan = tracer.startSpan('fry', { childOf: spanContext });

        assert.isOk(rootSpan.context().traceId);
        assert.isNotOk(rootSpan.context().parentId);
        assert.equal(rootSpan.context().flags, 1);
        assert.equal('Bender', rootSpan.getBaggageItem('robot'));
        assert.equal('Leela', rootSpan.getBaggageItem('female'));
        assert.equal('Fry', rootSpan.getBaggageItem('male'));
    });

    it('create a span correctly through _startInternalSpan', () => {
        let traceId = Utils.encodeInt64(1);
        let spanId = Utils.encodeInt64(2);
        let parentId = Utils.encodeInt64(3);
        let flags = 1;
        let context = SpanContext.withBinaryIds(traceId, spanId, parentId, flags);
        let start = 123.456;
        let rpcServer = false;
        let internalTags = [];
        let references = [];
        let tags = {
            'keyOne': 'leela',
            'keyTwo': 'bender'
        };
        let span = tracer._startInternalSpan(context, 'op-name', start, internalTags, tags, null, rpcServer, references);

        assert.deepEqual(span.context().traceId, traceId);
        assert.deepEqual(span.context().spanId, spanId);
        assert.deepEqual(span.context().parentId, parentId);
        assert.equal(span.context().flags, flags);
        assert.equal(span._startTime, start);
        assert.equal(Object.keys(span._tags).length, 2);
    });

    it ('report a span with no tracer level tags', () => {
        let span = tracer.startSpan('op-name');
        tracer._report(span);
        assert.isOk(reporter.spans.length, 1);
        let actualTags = _.sortBy(span._tags, (o) => {
            return o.key;
        });

        assert.equal(2, actualTags.length);
        assert.equal(actualTags[0].key, 'sampler.param');
        assert.equal(actualTags[1].key, 'sampler.type');
        assert.equal(actualTags[0].value, true);
        assert.equal(actualTags[1].value, 'const');
    });

    it ('start a root span with proper structure', () => {
        let startTime = new Date(2016, 8, 18).getTime();
        let span = tracer.startSpan('test-name', {
            startTime: startTime
        });

        assert.equal(span.context().traceId, span.context().spanId);
        assert.isNotOk(span.context().parentId);
        assert.isOk(span.context().isSampled());
        assert.equal(span._startTime, startTime);
    });

    it ('start a child span represented as a separate span from parent, using childOf and references', () => {
        let traceId = Utils.encodeInt64(1);
        let spanId = Utils.encodeInt64(2);
        let parentId = Utils.encodeInt64(3);
        let flags = 1;
        let context = SpanContext.withBinaryIds(traceId, spanId, parentId, flags);
        let startTime = 123.456;

        let childOfParams = {
            operationName: 'test-name',
            childOf: context,
            startTime: startTime
        };

        let referenceParams = {
            operationName: 'test-name',
            startTime: startTime,
            references: [new opentracing.Reference(opentracing.REFERENCE_CHILD_OF, context)],
        };

        let assertByStartSpanParameters = (params) => {
            let span = tracer.startSpan('test-span', params);
            assert.deepEqual(span.context().traceId, traceId);
            assert.deepEqual(span.context().parentId, spanId);
            assert.equal(span.context().flags, constants.SAMPLED_MASK);
            assert.equal(span._startTime, startTime);
        };

        assertByStartSpanParameters(childOfParams);
        assertByStartSpanParameters(referenceParams);
    });

    it ('inject plain text headers into carrier, and extract span context with the same value', () => {
        let keyOne = 'keyOne';
        let keyTwo = 'keyTwo';
        let baggage = {
            keyOne: 'leela',
            keyTwo: 'bender'
        };
        let savedContext = SpanContext.withBinaryIds(
            Utils.encodeInt64(1),
            Utils.encodeInt64(2),
            Utils.encodeInt64(3),
            constants.SAMPLED_MASK,
            baggage
        );

        let assertByFormat = (format) => {
            let carrier = {};
            tracer.inject(savedContext, format, carrier);
            let extractedContext = tracer.extract(format, carrier);

            assert.deepEqual(savedContext.traceId, extractedContext.traceId);
            assert.deepEqual(savedContext.spanId, extractedContext.spanId);
            assert.deepEqual(savedContext.parentId, extractedContext.parentId);
            assert.equal(savedContext.flags, extractedContext.flags);
            assert.equal(savedContext.baggage[keyOne], extractedContext.baggage[keyOne]);
            assert.equal(savedContext.baggage[keyTwo], extractedContext.baggage[keyTwo]);
        };

        assertByFormat(opentracing.FORMAT_TEXT_MAP);
        assertByFormat(opentracing.FORMAT_HTTP_HEADERS);
    });

    it ('inject url encoded values into headers', () => {
        let baggage = {
            keyOne: 'Leela vs. Bender',
        };
        let savedContext = SpanContext.withBinaryIds(
            Utils.encodeInt64(1),
            Utils.encodeInt64(2),
            Utils.encodeInt64(3),
            constants.SAMPLED_MASK,
            baggage
        );
        let carrier = {};

        tracer.inject(savedContext, opentracing.FORMAT_HTTP_HEADERS, carrier);
        assert.equal(carrier['uberctx-keyOne'], 'Leela%20vs.%20Bender');
    });

    it ('assert inject and extract throw errors when given an invalid format', () => {
        let carrier = {};
        let context = SpanContext.withBinaryIds(
            Utils.encodeInt64(1),
            Utils.encodeInt64(2),
            Utils.encodeInt64(3),
            constants.SAMPLED_MASK
        );

        // subtle but expect wants a function to call not the result of a function call.
        expect(() => {tracer.inject(context, 'fake-format', carrier)}).to.throw('Unsupported format: fake-format');
        expect(() => {tracer.extract('fake-format', carrier)}).to.throw('Unsupported format: fake-format');
    });

    it ('report spans', () => {
        let span = tracer.startSpan('operation');
        tracer._report(span);

        assert.equal(reporter.spans.length, 1);
    });

    describe('Metrics', () => {
        it ('startSpan', () => {
            let params = [
                { 'rpcServer': false, 'context': null, 'sampled': true, 'metrics': ['spansStarted', 'spansSampled', 'tracesStartedSampled']},
                { 'rpcServer': true, 'context': '1:2:100:1', 'sampled': true, 'metrics': ['spansStarted', 'spansSampled', 'tracesJoinedSampled']},
                { 'rpcServer': false, 'context': null, 'sampled': false, 'metrics': ['spansStarted', 'spansNotSampled', 'tracesStartedNotSampled']},
                { 'rpcServer': true, 'context': '1:2:100:0', 'sampled': false, 'metrics': ['spansStarted', 'spansNotSampled', 'tracesJoinedNotSampled']},
            ];

            _.each(params, (o) => {
                let metrics = new Metrics(new LocalMetricFactory());
                tracer = new Tracer('fry', new InMemoryReporter(), new ConstSampler(o.sampled), {
                    metrics: metrics
                });

                let context = null;
                if (o.context) {
                    context = SpanContext.fromString(o.context);
                }

                let tags = {};
                if (o.rpcServer) {
                    tags[opentracing.Tags.SPAN_KIND] = opentracing.Tags.SPAN_KIND_RPC_SERVER;
                }

                tracer.startSpan('bender', {
                    childOf: context,
                    tags: tags
                });

                _.each(o.metrics, (metricName) => {
                    assert.isOk(LocalBackend.counterEquals(metrics[metricName], 1));
                });
            });
        });

        it ('emits counter when report called', () => {
            let metrics = new Metrics(new LocalMetricFactory());
            tracer = new Tracer('fry', new InMemoryReporter(), new ConstSampler(true), {
                metrics: metrics
            });
            let span = tracer.startSpan('bender');
            tracer._report(span);

            assert.isOk(LocalBackend.counterEquals(metrics.spansFinished, 1));
        });
    });
});

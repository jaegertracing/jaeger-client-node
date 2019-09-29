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
import { assert, expect } from 'chai';
import ConstSampler from '../src/samplers/const_sampler';
import * as constants from '../src/constants';
import InMemoryReporter from '../src/reporters/in_memory_reporter';
import * as opentracing from 'opentracing';
import SpanContext from '../src/span_context';
import Tracer from '../src/tracer';
import Utils from '../src/util';
import Metrics from '../src/metrics/metrics';
import LocalMetricFactory from './lib/metrics/local/metric_factory';
import LocalBackend from './lib/metrics/local/backend';
import sinon from 'sinon';
import DefaultThrottler from '../src/throttler/default_throttler';
import os from 'os';
import JaegerTestUtils from '../src/test_util';

describe('tracer should', () => {
  let tracer;
  let reporter = new InMemoryReporter();

  beforeEach(() => {
    tracer = new Tracer('test-service-name', reporter, new ConstSampler(true));
  });

  afterEach(() => {
    reporter.clear();
    tracer.close();
  });

  it('be able to override codec contextKey and extract context', () => {
    let ck = 'test-trace-id';
    let mytracer = new Tracer('test-service-name', reporter, new ConstSampler(true), {
      contextKey: ck,
    });

    let headers = {
      'test-trace-id': 'a:b:c:d',
    };

    let mycontext = mytracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);
    assert.equal(mycontext.toString(), '000000000000000a:000000000000000b:000000000000000c:d');

    let myspan = mytracer.startSpan('myspan', { childOf: mycontext });
    assert.equal(myspan.context().traceIdStr, '000000000000000a');

    let exheaders = {};

    mytracer.inject(myspan.context(), opentracing.FORMAT_HTTP_HEADERS, exheaders);
    assert.notEqual(exheaders[ck], null);
  });

  it('find the ip and hostname by default', () => {
    assert.equal(tracer._tags[constants.PROCESS_IP], Utils.myIp());
    assert.equal(tracer._tags[constants.TRACER_HOSTNAME_TAG_KEY], os.hostname());
  });

  it('be able to override ip and hostname tags if provided', () => {
    let mytags = {};
    mytags[constants.PROCESS_IP] = '10.0.0.1';
    mytags[constants.TRACER_HOSTNAME_TAG_KEY] = '10.0.0.1.internal';
    let mytracer = new Tracer('test-service-name', reporter, new ConstSampler(true), {
      tags: mytags,
    });

    assert.equal(mytracer._tags[constants.PROCESS_IP], '10.0.0.1');
    assert.equal(mytracer._tags[constants.TRACER_HOSTNAME_TAG_KEY], '10.0.0.1.internal');
  });

  it('begin a new span given only baggage headers', () => {
    // Users sometimes want to pass baggage even if there is no span.
    // In this case we must ensure a new root span is created.
    let headers = {};
    // combine normal baggage encoding
    headers[constants.TRACER_BAGGAGE_HEADER_PREFIX + 'robot'] = 'Bender';
    // with custom encoding via `jaeger-baggage` header
    headers[constants.JAEGER_BAGGAGE_HEADER] = 'male=Fry, female=Leela, Lord Nibbler';
    let spanContext = tracer.extract(opentracing.FORMAT_TEXT_MAP, headers);
    let rootSpan = tracer.startSpan('fry', { childOf: spanContext });

    assert.isNotNull(rootSpan.context().traceId);
    assert.isDefined(rootSpan.context().traceId);
    assert.isNull(rootSpan.context().parentId);
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
    let tags = {
      keyOne: 'Leela',
      keyTwo: 'Bender',
    };
    let internalTags = {
      'internal-tag': 'Fry',
    };
    let references = [];
    let span = tracer._startInternalSpan(
      context,
      'op-name',
      start,
      tags,
      internalTags,
      references,
      false,
      rpcServer
    );

    assert.deepEqual(span.context().traceId, traceId);
    assert.deepEqual(span.context().spanId, spanId);
    assert.deepEqual(span.context().parentId, parentId);
    assert.equal(span.context().flags, flags);
    assert.equal(span._startTime, start);
    assert.isTrue(
      JaegerTestUtils.hasTags(span, {
        keyOne: 'Leela',
        keyTwo: 'Bender',
        'sampler.type': 'const',
        'sampler.param': true,
        'internal-tag': 'Fry',
      })
    );
  });

  it('report a span with no tracer level tags', () => {
    let span = tracer.startSpan('op-name');
    tracer._report(span);
    assert.equal(1, reporter.spans.length);
    let actualTags = _.sortBy(span._tags, o => {
      return o.key;
    });

    assert.equal(2, actualTags.length);
    assert.equal(actualTags[0].key, 'sampler.param');
    assert.equal(actualTags[1].key, 'sampler.type');
    assert.equal(actualTags[0].value, true);
    assert.equal(actualTags[1].value, 'const');
  });

  it('start a root span with proper structure', () => {
    let startTime = new Date(2016, 8, 18).getTime();
    let span = tracer.startSpan('test-name', {
      startTime: startTime,
    });

    assert.equal(span.context().traceId, span.context().spanId);
    assert.equal(span.context().parentId, null);
    assert.isTrue(span.context().isSampled());
    assert.equal(span._startTime, startTime);
  });

  describe('start a child span represented as a separate span from parent, using childOf and references', () => {
    let nextId = 0;
    const getId = () => Utils.encodeInt64(nextId++);
    const traceId = getId();
    const flags = 1;

    const parentContext = SpanContext.withBinaryIds(traceId, getId(), null, flags);
    const childOfContext = SpanContext.withBinaryIds(traceId, getId(), null, flags);
    const childOfRef = new opentracing.Reference(opentracing.REFERENCE_CHILD_OF, childOfContext);
    const followsFromContext = SpanContext.withBinaryIds(traceId, getId(), null, flags);
    const followsFromRef = new opentracing.Reference(opentracing.REFERENCE_FOLLOWS_FROM, followsFromContext);

    const testCases = [
      {
        message: 'starts a span based on childOf',
        spanOptions: {
          childOf: parentContext,
          references: [],
        },
        verify: parentContext,
      },
      {
        message: 'starts a span based on childOf, ignoring FOLLOWS_FROM',
        spanOptions: {
          childOf: parentContext,
          references: [followsFromRef],
        },
        verify: parentContext,
      },
      {
        message: 'starts a span based on childOf, ignoring CHILD_OF and FOLLOWS_FROM',
        spanOptions: {
          childOf: parentContext,
          references: [childOfRef, followsFromRef],
        },
        verify: parentContext,
      },
      {
        message: 'starts a span with parent falling back to the CHILD_OF ref',
        spanOptions: {
          childOf: null,
          references: [childOfRef],
        },
        verify: childOfContext,
      },
      {
        message: 'starts a span with parent falling back to the FOLLOWS_FROM ref',
        spanOptions: {
          childOf: null,
          references: [followsFromRef],
        },
        verify: followsFromContext,
      },
      {
        message: 'starts a span with parent falling back to the CHILD_OF ref and ignoring FOLLOWS_FROM',
        spanOptions: {
          childOf: null,
          references: [childOfRef, followsFromRef],
        },
        verify: childOfContext,
      },
    ];

    testCases.forEach(params => {
      const { message, spanOptions, verify } = params;
      it(message, () => {
        let span = tracer.startSpan('bender', {
          childOf: spanOptions.childOf,
          references: spanOptions.references,
        });
        span.finish();
        assert.deepEqual(span.context().traceId, verify.traceId);
        assert.deepEqual(span.context().parentId, verify.spanId);
      });
    });
  });

  it('inject and extract headers from carriers without Object prototypes', () => {
    let ck = 'test-trace-id';
    let mytracer = new Tracer('test-service-name', reporter, new ConstSampler(true), {
      contextKey: ck,
    });

    let headers = Object.create(null);
    headers[ck] = 'a:b:c:d';

    let mycontext = mytracer.extract(opentracing.FORMAT_HTTP_HEADERS, headers);
    assert.equal(mycontext.toString(), '000000000000000a:000000000000000b:000000000000000c:d');

    let myspan = mytracer.startSpan('myspan', { childOf: mycontext });
    assert.equal(myspan.context().traceIdStr, '000000000000000a');

    let exheaders = Object.create(null);

    mytracer.inject(myspan.context(), opentracing.FORMAT_HTTP_HEADERS, exheaders);
    assert.notEqual(exheaders[ck], null);
  });

  it('inject plain text headers into carrier, and extract span context with the same value', () => {
    let keyOne = 'keyOne';
    let keyTwo = 'keyTwo';
    let baggage = {
      keyOne: 'leela',
      keyTwo: 'bender',
    };
    let savedContext = SpanContext.withBinaryIds(
      Utils.encodeInt64(1),
      Utils.encodeInt64(2),
      Utils.encodeInt64(3),
      constants.SAMPLED_MASK,
      baggage
    );

    let assertByFormat = format => {
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

  it('inject plain text headers into carrier, and extract span context with the same value 128bits', () => {
    let keyOne = 'keyOne';
    let keyTwo = 'keyTwo';
    let baggage = {
      keyOne: 'leela',
      keyTwo: 'bender',
    };
    let savedContext = SpanContext.withBinaryIds(
      Buffer.concat([Utils.encodeInt64(1), Utils.encodeInt64(2)]),
      Utils.encodeInt64(2),
      Utils.encodeInt64(3),
      constants.SAMPLED_MASK,
      baggage
    );

    let assertByFormat = format => {
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

  it('inject url encoded values into headers', () => {
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

  it('assert inject and extract throw errors when given an invalid format', () => {
    let carrier = {};
    let context = SpanContext.withBinaryIds(
      Utils.encodeInt64(1),
      Utils.encodeInt64(2),
      Utils.encodeInt64(3),
      constants.SAMPLED_MASK
    );

    // subtle but expect wants a function to call not the result of a function call.
    expect(() => {
      tracer.inject(context, 'fake-format', carrier);
    }).to.throw('Unsupported format: fake-format');
    expect(() => {
      tracer.extract('fake-format', carrier);
    }).to.throw('Unsupported format: fake-format');
  });

  it('report spans', () => {
    let span = tracer.startSpan('operation');
    tracer._report(span);

    assert.equal(reporter.spans.length, 1);
  });

  it('set _process on initialization', () => {
    const throttler = new DefaultThrottler();
    throttler.setProcess = sinon.spy();
    tracer = new Tracer('x', reporter, new ConstSampler(true), {
      debugThrottler: throttler,
    });
    assert.equal(tracer._process.serviceName, 'x');
    assert.isString(tracer._process.uuid);
    sinon.assert.calledWith(throttler.setProcess, tracer._process);
  });

  it('close _debugThrottler on close', () => {
    const throttler = new DefaultThrottler();
    throttler.close = sinon.spy();
    tracer = new Tracer('x', reporter, new ConstSampler(true), {
      debugThrottler: throttler,
    });
    tracer.close();
    sinon.assert.calledOnce(throttler.close);
  });

  describe('Metrics', () => {
    it('startSpan', () => {
      let params = [
        {
          rpcServer: false,
          context: null,
          sampled: true,
          metrics: ['spansStartedSampled', 'tracesStartedSampled'],
        },
        {
          rpcServer: true,
          context: '1:2:100:1',
          sampled: true,
          metrics: ['spansStartedSampled', 'tracesJoinedSampled'],
        },
        {
          rpcServer: false,
          context: null,
          sampled: false,
          metrics: ['spansStartedNotSampled', 'tracesStartedNotSampled'],
        },
        {
          rpcServer: true,
          context: '1:2:100:0',
          sampled: false,
          metrics: ['spansStartedNotSampled', 'tracesJoinedNotSampled'],
        },
      ];

      _.each(params, o => {
        let metrics = new Metrics(new LocalMetricFactory());
        tracer = new Tracer('fry', new InMemoryReporter(), new ConstSampler(o.sampled), {
          metrics: metrics,
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
          tags: tags,
        });

        _.each(o.metrics, metricName => {
          assert.isTrue(LocalBackend.counterEquals(metrics[metricName], 1));
        });
      });
    });

    it('emits counter when report called', () => {
      let metrics = new Metrics(new LocalMetricFactory());
      tracer = new Tracer('fry', new InMemoryReporter(), new ConstSampler(true), {
        metrics: metrics,
      });
      let span = tracer.startSpan('bender');
      tracer._report(span);

      assert.isTrue(LocalBackend.counterEquals(metrics.spansFinished, 1));
    });
  });

  it('start a root span with 128 bit traceId', () => {
    tracer = new Tracer('test-service-name', reporter, new ConstSampler(true), { traceId128bit: true });
    let span = tracer.startSpan('test-name');

    assert.deepEqual(span.context().traceId.slice(-8), span.context().spanId);
    assert.equal(16, span.context().traceId.length);
  });

  it('preserve 64bit traceId even when in 128bit mode', () => {
    // NB: because we currently trim leading zeros, this test is not as effective as it could be.
    // But once https://github.com/jaegertracing/jaeger-client-node/issues/391 is fixed, this test
    // will be more useful as it can catch regression.
    tracer = new Tracer('test-service-name', reporter, new ConstSampler(true), { traceId128bit: true });
    let span = tracer.startSpan('test-name');
    assert.equal(16, span.context().traceId.length, 'new traces use 128bit IDs');

    let parent = SpanContext.fromString('100:7f:0:1');
    assert.equal(8, parent.traceId.length, 'respect 64bit length');

    let child = tracer.startSpan('test-name', { childOf: parent });
    assert.equal(8, child.context().traceId.length, 'preserve 64bit length');

    let carrier = {};
    tracer.inject(child.context(), opentracing.FORMAT_TEXT_MAP, carrier);
    // Once https://github.com/jaegertracing/jaeger-client-node/issues/391 is fixed, the following
    // asset will fail and will need to be changed to compare against '0000000000000100' string.
    assert.equal('0000000000000100:', carrier['uber-trace-id'].substring(0, 17), 'preserve 64bit length');
  });

  it('should NOT mutate tags', () => {
    const tags = {
      robot: 'bender',
    };
    tracer = new Tracer('test-service-name', reporter, new ConstSampler(true), {
      tags: tags,
    });
    tracer.close();
    assert.notEqual(tags, tracer._tags);
    assert.deepEqual(tags, {
      robot: 'bender',
    });
  });
});

it('should match parent and spanIds when in rpc server mode', () => {
  let traceId = Utils.encodeInt64(1);
  let spanId = Utils.encodeInt64(2);
  let flags = 1;
  const parentContext = SpanContext.withBinaryIds(traceId, spanId, null, flags);

  let tags = {};
  tags[opentracing.Tags.SPAN_KIND] = opentracing.Tags.SPAN_KIND_RPC_SERVER;

  let customReporter = new InMemoryReporter();
  let customTracer = new Tracer('test-service-name', customReporter, new ConstSampler(true), {
    shareRpcSpan: true,
  });
  let span = customTracer.startSpan('bender', {
    childOf: parentContext,
    tags: tags,
  });

  assert.equal(parentContext.spanId, span._spanContext.spanId);
  assert.equal(parentContext.parentId, span._spanContext.parentId);

  customReporter.clear();
  customTracer.close();
});

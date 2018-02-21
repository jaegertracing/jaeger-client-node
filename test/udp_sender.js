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
import ConstSampler from '../src/samplers/const_sampler.js';
import dgram from 'dgram';
import fs from 'fs';
import path from 'path';
import semver from 'semver';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import RemoteReporter from '../src/reporters/remote_reporter.js';
import opentracing from 'opentracing';
import Tracer from '../src/tracer.js';
import { Thrift } from 'thriftrw';
import ThriftUtils from '../src/thrift.js';
import UDPSender from '../src/reporters/udp_sender.js';

const PORT = 6832;
const HOST = '127.0.0.1';

describe('udp sender', () => {
  let server;
  let tracer;
  let thrift;
  let sender;

  function assertThriftSpanEqual(assert, spanOne, spanTwo) {
    assert.deepEqual(spanOne.traceIdLow, spanTwo.traceIdLow);
    assert.deepEqual(spanOne.traceIdHigh, spanTwo.traceIdHigh);
    assert.deepEqual(spanOne.spanId, spanTwo.spanId);
    assert.deepEqual(spanOne.parentSpanId, spanTwo.parentSpanId);
    assert.equal(spanOne.operationName, spanTwo.operationName);
    assert.deepEqual(spanOne.references, spanTwo.references);
    assert.equal(spanOne.flags, spanTwo.flags);
    assert.deepEqual(spanOne.startTime, spanTwo.startTime);
    assert.deepEqual(spanOne.duration, spanTwo.duration);
  }

  beforeEach(() => {
    server = dgram.createSocket('udp4');
    server.bind(PORT, HOST);
    let reporter = new InMemoryReporter();
    tracer = new Tracer('test-service-name', reporter, new ConstSampler(true));
    sender = new UDPSender();
    sender.setProcess(reporter._process);
    thrift = new Thrift({
      entryPoint: path.join(__dirname, '../src/thriftrw-idl/agent.thrift'),
      allowOptionalArguments: true,
      allowFilesystemAccess: true,
    });
  });

  afterEach(() => {
    tracer.close();
    server.close();
  });

  function assertCallback(expectedNumSpans, expectedError): SenderCallback {
    return (numSpans, error) => {
      assert.equal(numSpans, expectedNumSpans);
      assert.equal(error, expectedError);
    };
  }

  it('should read and verify spans and process sent', done => {
    let spanOne = tracer.startSpan('operation-one');
    spanOne.finish(); // finish to set span duration
    spanOne = ThriftUtils.spanToThrift(spanOne);
    let spanTwo = tracer.startSpan('operation-two');
    spanTwo.finish(); // finish to set span duration
    spanTwo = ThriftUtils.spanToThrift(spanTwo);

    // make sure sender can fit both spans
    let maxSpanBytes = sender._calcSpanSize(spanOne).length + sender._calcSpanSize(spanTwo).length + 30;
    sender._maxSpanBytes = maxSpanBytes;

    server.on('message', (msg, remote) => {
      let thriftObj = thrift.Agent.emitBatch.argumentsMessageRW.readFrom(msg, 0);
      let batch = thriftObj.value.body.batch;
      assert.isOk(batch);
      assert.equal(batch.spans.length, 2);

      assertThriftSpanEqual(assert, spanOne, batch.spans[0]);
      assertThriftSpanEqual(assert, spanTwo, batch.spans[1]);

      assert.equal(batch.process.serviceName, 'test-service-name');
      let actualTags = _.sortBy(batch.process.tags, o => {
        return o.key;
      });
      assert.equal(actualTags.length, 3);
      assert.equal(actualTags[0].key, 'ip');
      assert.equal(actualTags[1].key, 'jaeger.hostname');
      assert.equal(actualTags[2].key, 'jaeger.version');

      sender.close();
      done();
    });

    sender.append(spanOne, assertCallback(0, undefined));
    sender.append(spanTwo, assertCallback(0, undefined));
    sender.flush(assertCallback(2, undefined));
  });

  describe('span reference tests', () => {
    let tracer = new Tracer('test-service-name', new InMemoryReporter(), new ConstSampler(true));
    let parentContext = tracer.startSpan('just-used-for-context').context();
    let childOfContext = tracer.startSpan('just-used-for-context').context();
    let childOfRef = new opentracing.Reference(opentracing.REFERENCE_CHILD_OF, childOfContext);
    let followsFromContext = tracer.startSpan('just-used-for-context').context();
    let followsFromRef = new opentracing.Reference(opentracing.REFERENCE_FOLLOWS_FROM, followsFromContext);

    let options = [
      { childOf: null, references: [], expectedTraceId: null, expectedParentId: null },
      {
        childOf: parentContext,
        references: [],
        expectedTraceId: parentContext.traceId,
        expectedParentId: parentContext.parentId,
      },
      {
        childOf: parentContext,
        references: [followsFromRef],
        expectedTraceId: parentContext.traceId,
        expectedParentId: parentContext.parentId,
      },
      {
        childOf: parentContext,
        references: [childOfRef, followsFromRef],
        expectedTraceId: parentContext.traceId,
        expectedParentId: parentContext.parentId,
      },
      {
        childOf: null,
        references: [childOfRef],
        expectedTraceId: childOfContext.traceId,
        expectedParentId: childOfContext.parentId,
      },
      {
        childOf: null,
        references: [followsFromRef],
        expectedTraceId: followsFromContext.traceId,
        expectedParentId: followsFromContext.parentId,
      },
      {
        childOf: null,
        references: [childOfRef, followsFromRef],
        expectedTraceId: childOfContext.traceId,
        expectedParentId: childOfContext.parentId,
      },
    ];

    _.each(options, o => {
      it('should serialize span references', done => {
        let span = tracer.startSpan('bender', {
          childOf: o.childOf,
          references: o.references,
        });
        span.finish();
        span = ThriftUtils.spanToThrift(span);

        server.on('message', function(msg, remote) {
          let thriftObj = thrift.Agent.emitBatch.argumentsMessageRW.readFrom(msg, 0);
          let batch = thriftObj.value.body.batch;
          let span = batch.spans[0];
          let ref = span.references[0];

          assert.isOk(batch);
          assertThriftSpanEqual(assert, span, batch.spans[0]);
          if (o.expectedTraceId) {
            assert.deepEqual(span.traceIdLow, o.expectedTraceId);
          }

          if (o.expectedParentId) {
            assert.deepEqual(span.parentId, o.expectedParentId);
          } else {
            assert.isNotOk(span.parentId);
          }

          sender.close();
          done();
        });

        sender.append(span);
        sender.flush();
      });
    });
  });

  it('should flush spans when capacity is reached', () => {
    let spanOne = tracer.startSpan('operation-one');
    spanOne.finish(); // finish to set span duration
    spanOne = ThriftUtils.spanToThrift(spanOne);
    let spanSize = sender._calcSpanSize(spanOne).length;
    sender._maxSpanBytes = spanSize * 2;

    sender.append(spanOne, assertCallback(0, undefined));
    sender.append(spanOne, assertCallback(2, undefined));

    assert.equal(sender._batch.spans.length, 0);
    assert.equal(sender._totalSpanBytes, 0);
  });

  it('should flush spans when just over capacity', done => {
    let spanOne = tracer.startSpan('operation-one');
    spanOne.finish(); // finish to set span duration
    spanOne = ThriftUtils.spanToThrift(spanOne);
    let spanSize = sender._calcSpanSize(spanOne).length;
    sender._maxSpanBytes = spanSize * 2;

    let spanThatExceedsCapacity = tracer.startSpan('bigger-span');
    spanThatExceedsCapacity.setTag('some-key', 'some-value');
    spanThatExceedsCapacity.finish(); // finish to set span duration
    spanThatExceedsCapacity = ThriftUtils.spanToThrift(spanThatExceedsCapacity);
    let largeSpanSize = sender._calcSpanSize(spanThatExceedsCapacity).length;

    sender.append(spanOne, assertCallback(0, undefined));
    sender.append(spanThatExceedsCapacity, (numSpans, error) => {
      assert.equal(numSpans, 1);
      assert.equal(error, undefined);

      assert.equal(sender._batch.spans.length, 1);
      assert.equal(sender._totalSpanBytes, largeSpanSize);
      done();
    });
  });

  it('should returns error from flush() on failed buffer conversion', done => {
    let span = tracer.startSpan('leela');
    span.finish(); // finish to set span duration
    span = ThriftUtils.spanToThrift(span);
    span.flags = 'string'; // malform the span to create a serialization error
    sender.append(span);
    sender.flush((numSpans, err) => {
      assert.equal(numSpans, 1);
      expect(err).to.have.string('error writing Thrift object:');
      done();
    });
  });

  it('should return error upon thrift conversion failure', done => {
    sender._logger = {
      error: msg => {
        expect(msg).to.have.string('error converting span to Thrift:');
        done();
      },
    };
    let span = tracer.startSpan(undefined);
    span.finish();

    sender.append(ThriftUtils.spanToThrift(span), (numSpans, err) => {
      assert.equal(numSpans, 1);
      expect(err).to.have.string('error converting span to Thrift:');
      done();
    });
  });

  it('should return error on span too large', done => {
    let span = tracer.startSpan('op-name');
    span.finish(); // otherwise duration will be undefined

    sender._maxSpanBytes = 1;
    sender.append(ThriftUtils.spanToThrift(span), (numSpans, err) => {
      assert.equal(numSpans, 1);
      expect(err).to.have.string('is larger than maxSpanSize');
      done();
    });
  });

  it('should return 0,undefined on flush() with no spans', () => {
    sender.flush(assertCallback(0, undefined));
  });

  it('should gracefully handle errors emitted by socket.send', done => {
    sender._host = 'foo.bar.xyz';
    // In Node 0.10 and 0.12 the error is logged twice: (1) from inline callback, (2) from on('error') handler.
    let expectLogs = semver.satisfies(process.version, '0.10.x || 0.12.x');
    sender._logger = {
      info: msg => {
        console.log('sender info: ' + msg);
      },
      error: msg => {
        assert.isOk(expectLogs);
        expect(msg).to.have.string('error sending spans over UDP: Error: getaddrinfo ENOTFOUND');
        done();
      },
    };
    let tracer = new Tracer('test-service-name', new RemoteReporter(sender), new ConstSampler(true));
    tracer.startSpan('testSpan').finish();
    sender.flush((numSpans, err) => {
      assert.equal(numSpans, 1);
      expect(err).to.have.string('error sending spans over UDP: Error: getaddrinfo ENOTFOUND');
      if (!expectLogs) {
        done();
      }
    });
  });
});

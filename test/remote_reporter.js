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
import InMemoryReporter from '../src/reporters/in_memory_reporter';
import MockLogger from './lib/mock_logger';
import RemoteReporter from '../src/reporters/remote_reporter';
import Tracer from '../src/tracer';
import UDPSender from '../src/reporters/udp_sender';
import Metrics from '../src/metrics/metrics';
import LocalMetricFactory from './lib/metrics/local/metric_factory';
import LocalBackend from './lib/metrics/local/backend';

describe('Remote Reporter', () => {
  let tracer;
  let reporter;
  let sender;
  let logger;
  let metrics;

  beforeEach(() => {
    try {
      metrics = new Metrics(new LocalMetricFactory());
      sender = new UDPSender();
      logger = new MockLogger();
      reporter = new RemoteReporter(sender, {
        logger: logger,
        metrics: metrics,
      });
      tracer = new Tracer('test-service-name', reporter, new ConstSampler(true));
    } catch (e) {
      // this is useful to catch errors when thrift definition is changed
      console.log('beforeEach failed', e);
      console.log(e.stack);
    }
  });

  afterEach(() => {
    logger.clear();
    let callback = () => {}; // added for coverage reasons
    reporter.close(callback);
  });

  it('should report span, and flush', done => {
    let span = tracer.startSpan('operation-name');

    // add duration to span, and report it
    span.finish();
    assert.equal(sender._batch.spans.length, 1);

    reporter.flush(() => {
      assert.equal(sender._batch.spans.length, 0);
      assert.isOk(LocalBackend.counterEquals(metrics.reporterSuccess, 1));
      done();
    });
  });

  it('should have coverage for simple code paths', () => {
    let sender = new UDPSender();
    sender.setProcess({
      serviceName: 'service-name',
      tags: [],
    });
    let reporter = new RemoteReporter(sender);

    assert.equal(reporter.name(), 'RemoteReporter');

    reporter.close();
  });

  it('should throw exception when initialized without a sender', () => {
    expect(() => {
      new RemoteReporter();
    }).to.throw('RemoteReporter must be given a Sender.');
  });

  it('should fail to flush spans with bad sender', done => {
    let mockSender = {
      flush: callback => {
        callback(1, 'mock error');
      },
      close: () => {},
    };

    reporter._sender = mockSender;
    reporter.flush(() => {
      expect(logger._errorMsgs[0]).to.have.string('Failed to flush spans in reporter');
      assert.isOk(LocalBackend.counterEquals(metrics.reporterFailure, 1));
      done();
    });
  });

  it('should not flush if process is not set', done => {
    reporter = new RemoteReporter(sender, {
      logger: logger,
    });
    reporter.flush(() => {
      expect(logger._errorMsgs[0]).to.have.string('Failed to flush since process is not set');
      done();
    });
  });
});

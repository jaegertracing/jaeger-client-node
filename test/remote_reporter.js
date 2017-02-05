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

import _ from 'lodash';
import {assert, expect} from 'chai';
import ConstSampler from '../src/samplers/const_sampler';
import InMemoryReporter from '../src/reporters/in_memory_reporter';
import MockLogger from './lib/mock_logger';
import RemoteReporter from '../src/reporters/remote_reporter';
import Tracer from '../src/tracer';
import UDPSender from '../src/reporters/udp_sender';
import Metrics from '../src/metrics/metrics';
import LocalMetricFactory from './lib/metrics/local/metric_factory';
import LocalBackend from './lib/metrics/local/backend';

describe('Composite and Remote Reporter should', () => {
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
                metrics: metrics
            });
            tracer = new Tracer(
                'test-service-name',
                reporter,
                new ConstSampler(true)
            );
        } catch (e) {
            // this is useful to catch errors when thrift definition is changed
            console.log('beforeEach failed', e);
            console.log(e.stack);
        }
    });

    afterEach(() => {
        logger.clear();
        let callback = () => {} // added for coverage reasons
        reporter.close(callback);
    });

    it ('report span, and flush', () => {
        let span = tracer.startSpan('operation-name');

        // add duration to span, and report it
        span.finish();
        assert.equal(sender._batch.spans.length, 1);

        reporter.flush();
        assert.equal(sender._batch.spans.length, 0);
        assert.isOk(LocalBackend.counterEquals(metrics.reporterSuccess, 1));
    });

    it ('report and flush span that is causes an error to be logged', () => {
        // make it so that all spans will be too large to be appended
        sender._maxSpanBytes = 1;

        let span = tracer.startSpan('operation-name');

        span.finish();
        assert.equal(logger._errorMsgs[0], 'Failed to append spans in reporter.');

        // metrics
        assert.isOk(LocalBackend.counterEquals(metrics.reporterDropped, 1));
    });

    it ('should have coverage for simple code paths', () => {
        let sender = new UDPSender();
        sender.setProcess({
            serviceName: 'service-name',
            tags: []
        });
        let reporter = new RemoteReporter(sender);

        assert.equal(reporter.name(), 'RemoteReporter');

        reporter.close();
    });

    it ('should throw exception when initialized without a sender', () => {
        expect(() => { new RemoteReporter(); }).to.throw('RemoteReporter must be given a Sender.');
    });

    it ('failed to flush spans with reporter', () => {
        let mockSender = {
            flush: () => {
                return {
                    err: true,
                    numSpans: 1
                };
            },
            close: () => {}
        };

        reporter._sender = mockSender;
        reporter.flush();

        assert.equal(logger._errorMsgs[0], 'Failed to flush spans in reporter.');
        assert.isOk(LocalBackend.counterEquals(metrics.reporterFailure, 1));
    });
});

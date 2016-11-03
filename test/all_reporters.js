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

import { assert } from 'chai';
import CompositeReporter from '../src/reporters/composite_reporter';
import InMemoryReporter from '../src/reporters/in_memory_reporter';
import NoopReporter from '../src/reporters/noop_reporter';
import RemoteReporter from '../src/reporters/remote_reporter';
import UDPSender from '../src/reporters/udp_sender';
import MockLogger from './lib/mock_logger';
import LoggingReporter from '../src/reporters/logging_reporter';

describe('All Reporters should', () => {
    it ('have proper names', () => {
        let loggingReporter = new LoggingReporter();
        let inMemoryReporter = new InMemoryReporter();
        inMemoryReporter.setProcess('service-name', []);
        let noopReporter = new NoopReporter();
        let remoteReporter = new RemoteReporter();
        let compositeReporter = new CompositeReporter();

        assert.equal(loggingReporter.name(), 'LoggingReporter');
        assert.equal(inMemoryReporter.name(), 'InMemoryReporter');
        assert.equal(noopReporter.name(), 'NoopReporter');
        assert.equal(remoteReporter.name(), 'RemoteReporter');
        assert.equal(compositeReporter.name(), 'CompositeReporter');
    });

    it ('flush, clear, and close are covered', () => {
        let loggingReporter = new LoggingReporter();
        let inMemoryReporter = new InMemoryReporter();
        inMemoryReporter.setProcess('service-name', []);
        let noopReporter = new NoopReporter();
        let sender = new UDPSender();
        sender.setProcess(inMemoryReporter._process);
        let remoteReporter = new RemoteReporter(sender);
        let reporters = [
            loggingReporter,
            inMemoryReporter,
            noopReporter,
            remoteReporter
        ];

        let reporter = new CompositeReporter(reporters);
        let closeCalled = false;
        let flushCalled = false;
        let closeCallback = () => { closeCalled = true; };
        let flushCallback = () => { flushCalled = true; };

        reporter.clear();
        reporter.flush(flushCallback);
        reporter.close(closeCallback);

        // covered without callbacks
        reporter.flush();
        reporter.close(() => {
            assert.isOk(closeCalled);
            assert.isOk(flushCalled);
        });
    });

    describe('Logging reporter', () => {
        it('report span, and do nothing on clear and close', () => {
            let logger = new MockLogger();
            let reporter = new LoggingReporter(logger);

            let spanMock = { key: 'some-span' };
            reporter.report(spanMock);

            assert.equal(logger._infoMsgs[0], 'Reporting span {"key":"some-span"}');
        });
    });
});

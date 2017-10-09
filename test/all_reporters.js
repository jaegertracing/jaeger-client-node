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
import { assert } from 'chai';
import CompositeReporter from '../src/reporters/composite_reporter';
import InMemoryReporter from '../src/reporters/in_memory_reporter';
import NoopReporter from '../src/reporters/noop_reporter';
import RemoteReporter from '../src/reporters/remote_reporter';
import UDPSender from '../src/reporters/udp_sender';
import MockLogger from './lib/mock_logger';
import LoggingReporter from '../src/reporters/logging_reporter';
import sinon from 'sinon';

describe('All Reporters should', () => {
    let reporters;
    beforeEach(() => {
        let loggingReporter = new LoggingReporter();
        let inMemoryReporter = new InMemoryReporter();
        inMemoryReporter.setProcess('service-name', []);
        let noopReporter = new NoopReporter();
        let sender = new UDPSender();
        sender.setProcess(inMemoryReporter._process);
        let remoteReporter = new RemoteReporter(sender);
        reporters = [
            loggingReporter,
            inMemoryReporter,
            noopReporter,
            remoteReporter
        ];
    });

    it ('have proper names', () => {
        let loggingReporter = new LoggingReporter();
        let inMemoryReporter = new InMemoryReporter();
        inMemoryReporter.setProcess('service-name', []);
        let noopReporter = new NoopReporter();
        let remoteReporter = new RemoteReporter(new UDPSender());
        let compositeReporter = new CompositeReporter();

        assert.equal(loggingReporter.name(), 'LoggingReporter');
        assert.equal(inMemoryReporter.name(), 'InMemoryReporter');
        assert.equal(noopReporter.name(), 'NoopReporter');
        assert.equal(remoteReporter.name(), 'RemoteReporter');
        assert.equal(compositeReporter.name(), 'CompositeReporter');
    });

    let closeOptions = [
        { callback: sinon.spy(), predicate: (spy) => { return spy.calledOnce === true; }},
        { callback: null, predicate: (spy) => { return true; }}
    ];

    _.each(closeOptions, (o) => {
        it ('calls to close execute callback correctly', () => {
            let reporter = new CompositeReporter(reporters);

            reporter.close(o.callback);

            assert.isOk(o.predicate(o.callback));
        });
    });

    describe('Logging reporter', () => {
        it('logs span as context().toString()', () => {
            let logger = new MockLogger();
            let reporter = new LoggingReporter(logger);
            let spanMock = {
                context: function context() {
                    return {
                        toString: function toString() {
                            return "span-as-string";
                        }
                    };
                }
            };

            reporter.report(spanMock);

            assert.equal(logger._infoMsgs[0], 'Reporting span span-as-string');
        });
    });

    describe('Composite reporter', () => {
        it ('should report spans', () => {
            let mockReporter = {
                report: sinon.spy()
            };
            let reporter = new CompositeReporter([mockReporter]);
            reporter.report();

            assert.isOk(mockReporter.report.calledOnce);
        });
    });
});

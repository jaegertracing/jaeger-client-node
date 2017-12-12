'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _chai = require('chai');

var _composite_reporter = require('../src/reporters/composite_reporter');

var _composite_reporter2 = _interopRequireDefault(_composite_reporter);

var _in_memory_reporter = require('../src/reporters/in_memory_reporter');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _noop_reporter = require('../src/reporters/noop_reporter');

var _noop_reporter2 = _interopRequireDefault(_noop_reporter);

var _remote_reporter = require('../src/reporters/remote_reporter');

var _remote_reporter2 = _interopRequireDefault(_remote_reporter);

var _udp_sender = require('../src/reporters/udp_sender');

var _udp_sender2 = _interopRequireDefault(_udp_sender);

var _mock_logger = require('./lib/mock_logger');

var _mock_logger2 = _interopRequireDefault(_mock_logger);

var _logging_reporter = require('../src/reporters/logging_reporter');

var _logging_reporter2 = _interopRequireDefault(_logging_reporter);

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

describe('All Reporters should', function () {
    var reporters = void 0;
    beforeEach(function () {
        var loggingReporter = new _logging_reporter2.default();
        var inMemoryReporter = new _in_memory_reporter2.default();
        inMemoryReporter.setProcess('service-name', []);
        var noopReporter = new _noop_reporter2.default();
        var sender = new _udp_sender2.default();
        sender.setProcess(inMemoryReporter._process);
        var remoteReporter = new _remote_reporter2.default(sender);
        reporters = [loggingReporter, inMemoryReporter, noopReporter, remoteReporter];
    });

    it('have proper names', function () {
        var loggingReporter = new _logging_reporter2.default();
        var inMemoryReporter = new _in_memory_reporter2.default();
        inMemoryReporter.setProcess('service-name', []);
        var noopReporter = new _noop_reporter2.default();
        var remoteReporter = new _remote_reporter2.default(new _udp_sender2.default());
        var compositeReporter = new _composite_reporter2.default();

        _chai.assert.equal(loggingReporter.name(), 'LoggingReporter');
        _chai.assert.equal(inMemoryReporter.name(), 'InMemoryReporter');
        _chai.assert.equal(noopReporter.name(), 'NoopReporter');
        _chai.assert.equal(remoteReporter.name(), 'RemoteReporter');
        _chai.assert.equal(compositeReporter.name(), 'CompositeReporter');
    });

    var closeOptions = [{ callback: _sinon2.default.spy(), predicate: function predicate(spy) {
            return spy.calledOnce === true;
        } }, { callback: null, predicate: function predicate(spy) {
            return true;
        } }];

    _lodash2.default.each(closeOptions, function (o) {
        it('calls to close execute callback correctly', function () {
            var reporter = new _composite_reporter2.default(reporters);

            reporter.close(o.callback);

            _chai.assert.isOk(o.predicate(o.callback));
        });
    });

    describe('Logging reporter', function () {
        it('logs span as context().toString()', function () {
            var logger = new _mock_logger2.default();
            var reporter = new _logging_reporter2.default(logger);
            var spanMock = {
                context: function context() {
                    return {
                        toString: function toString() {
                            return "span-as-string";
                        }
                    };
                }
            };

            reporter.report(spanMock);

            _chai.assert.equal(logger._infoMsgs[0], 'Reporting span span-as-string');
        });
    });

    describe('Composite reporter', function () {
        it('should report spans', function () {
            var mockReporter = {
                report: _sinon2.default.spy()
            };
            var reporter = new _composite_reporter2.default([mockReporter]);
            reporter.report();

            _chai.assert.isOk(mockReporter.report.calledOnce);
        });
    });
});
//# sourceMappingURL=all_reporters.js.map
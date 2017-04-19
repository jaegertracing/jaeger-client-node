'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _logger = require('../logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _thrift = require('../thrift.js');

var _thrift2 = _interopRequireDefault(_thrift);

var _metrics = require('../metrics/metrics.js');

var _metrics2 = _interopRequireDefault(_metrics);

var _metric_factory = require('../metrics/noop/metric_factory');

var _metric_factory2 = _interopRequireDefault(_metric_factory);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DEFAULT_BUFFER_FLUSH_INTERVAL_MILLIS = 10000;

var RemoteReporter = function () {
    function RemoteReporter(sender) {
        var _this = this;

        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        _classCallCheck(this, RemoteReporter);

        if (!sender) {
            throw new Error('RemoteReporter must be given a Sender.');
        }

        this._bufferFlushInterval = options.bufferFlushInterval || DEFAULT_BUFFER_FLUSH_INTERVAL_MILLIS;
        this._logger = options.logger || new _logger2.default();
        this._sender = sender;
        this._intervalHandle = setInterval(function () {
            _this.flush();
        }, this._bufferFlushInterval);
        this._metrics = options.metrics || new _metrics2.default(new _metric_factory2.default());
    }

    _createClass(RemoteReporter, [{
        key: 'name',
        value: function name() {
            return 'RemoteReporter';
        }
    }, {
        key: 'report',
        value: function report(span) {
            var response = this._sender.append(_thrift2.default.spanToThrift(span));
            if (response.err) {
                this._logger.error('Failed to append spans in reporter.');
                this._metrics.reporterDropped.increment(response.numSpans);
            }
        }
    }, {
        key: 'flush',
        value: function flush(callback) {
            var response = this._sender.flush();
            if (response.err) {
                this._logger.error('Failed to flush spans in reporter.');
                this._metrics.reporterFailure.increment(response.numSpans);
            } else {
                this._metrics.reporterSuccess.increment(response.numSpans);
            }

            if (callback) {
                callback();
            }
        }
    }, {
        key: 'close',
        value: function close(callback) {
            clearInterval(this._intervalHandle);
            this._sender.flush();
            this._sender.close();

            if (callback) {
                callback();
            }
        }
    }, {
        key: 'setProcess',
        value: function setProcess(serviceName, tags) {
            this._process = {
                'serviceName': serviceName,
                'tags': _thrift2.default.getThriftTags(tags)
            };

            this._sender.setProcess(this._process);
        }
    }]);

    return RemoteReporter;
}();

exports.default = RemoteReporter;
//# sourceMappingURL=remote_reporter.js.map
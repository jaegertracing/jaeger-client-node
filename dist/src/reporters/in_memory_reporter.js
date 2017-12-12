'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _span = require('../span.js');

var _span2 = _interopRequireDefault(_span);

var _thrift = require('../thrift.js');

var _thrift2 = _interopRequireDefault(_thrift);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var InMemoryReporter = function () {
    function InMemoryReporter() {
        _classCallCheck(this, InMemoryReporter);

        this._spans = [];
    }

    _createClass(InMemoryReporter, [{
        key: 'name',
        value: function name() {
            return 'InMemoryReporter';
        }
    }, {
        key: 'report',
        value: function report(span) {
            this._spans.push(span);
        }
    }, {
        key: 'clear',
        value: function clear() {
            this._spans = [];
        }
    }, {
        key: 'close',
        value: function close(callback) {
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
        }
    }, {
        key: 'spans',
        get: function get() {
            return this._spans;
        }
    }]);

    return InMemoryReporter;
}();

exports.default = InMemoryReporter;
//# sourceMappingURL=in_memory_reporter.js.map
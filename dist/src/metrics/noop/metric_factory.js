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

var _counter = require('./counter');

var _counter2 = _interopRequireDefault(_counter);

var _timer = require('./timer');

var _timer2 = _interopRequireDefault(_timer);

var _gauge = require('./gauge');

var _gauge2 = _interopRequireDefault(_gauge);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NoopMetricFactory = function () {
    function NoopMetricFactory() {
        _classCallCheck(this, NoopMetricFactory);
    }

    _createClass(NoopMetricFactory, [{
        key: 'createCounter',
        value: function createCounter(name, tags) {
            return new _counter2.default();
        }
    }, {
        key: 'createTimer',
        value: function createTimer(name, tags) {
            return new _timer2.default();
        }
    }, {
        key: 'createGauge',
        value: function createGauge(name, tags) {
            return new _gauge2.default();
        }
    }]);

    return NoopMetricFactory;
}();

exports.default = NoopMetricFactory;
//# sourceMappingURL=metric_factory.js.map
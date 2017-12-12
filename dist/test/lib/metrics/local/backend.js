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

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _counter = require('./counter');

var _counter2 = _interopRequireDefault(_counter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LocalBackend = function () {
    function LocalBackend() {
        _classCallCheck(this, LocalBackend);

        this.reset();
    }

    _createClass(LocalBackend, [{
        key: 'reset',
        value: function reset() {
            this._counterValues = {};
            this._counterTags = {};
            this._timerValues = {};
            this._timerTags = {};
            this._gaugeValues = {};
            this._gaugeTags = {};
        }
    }, {
        key: 'increment',
        value: function increment(name, delta, tags) {
            if (this._counterValues[name] === undefined) {
                this._counterValues[name] = 0;
            }
            this._counterValues[name] += delta;
            this._counterTags[name] = tags;
        }
    }, {
        key: 'record',
        value: function record(name, value, tags) {
            this._timerValues[name] = value;
            this._timerTags[name] = tags;
        }
    }, {
        key: 'gauge',
        value: function gauge(name, value, tags) {
            this._gaugeValues[name] = value;
            this._gaugeTags[name] = tags;
        }
    }], [{
        key: 'counterEquals',
        value: function counterEquals(counter, value) {
            var valueEqual = counter._backend._counterValues[counter._name] === value;
            var tagsEqual = _lodash2.default.isEqual(counter._backend._counterTags[counter._name], counter._tags);
            return valueEqual && tagsEqual;
        }
    }, {
        key: 'counterValue',
        value: function counterValue(counter) {
            return counter._backend._counterValues[counter._name];
        }
    }]);

    return LocalBackend;
}();

exports.default = LocalBackend;
//# sourceMappingURL=backend.js.map
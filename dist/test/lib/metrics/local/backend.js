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
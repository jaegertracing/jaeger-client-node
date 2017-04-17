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

var _span = require('../span.js');

var _span2 = _interopRequireDefault(_span);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CompositeReporter = function () {
    function CompositeReporter(reporters) {
        _classCallCheck(this, CompositeReporter);

        this._reporters = reporters;
    }

    _createClass(CompositeReporter, [{
        key: 'name',
        value: function name() {
            return 'CompositeReporter';
        }
    }, {
        key: 'report',
        value: function report(span) {
            this._reporters.forEach(function (r) {
                r.report(span);
            });
        }
    }, {
        key: 'compositeCallback',
        value: function compositeCallback(callback) {
            var _this = this;

            var count = 0;
            return function () {
                count++;
                if (count >= _this._reporters.length) {
                    if (callback) {
                        callback();
                    }
                }
            };
        }
    }, {
        key: 'close',
        value: function close(callback) {
            var modifiedCallback = this.compositeCallback(callback);
            this._reporters.forEach(function (r) {
                r.close(modifiedCallback);
            });
        }
    }, {
        key: 'setProcess',
        value: function setProcess(serviceName, tags) {
            this._reporters.forEach(function (r) {
                if (r.setProcess) {
                    r.setProcess(serviceName, tags);
                }
            });
        }
    }]);

    return CompositeReporter;
}();

exports.default = CompositeReporter;
//# sourceMappingURL=composite_reporter.js.map
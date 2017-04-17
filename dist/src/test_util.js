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

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _span = require('./span');

var _span2 = _interopRequireDefault(_span);

var _util = require('./util');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TestUtils = function () {
    function TestUtils() {
        _classCallCheck(this, TestUtils);
    }

    _createClass(TestUtils, null, [{
        key: 'hasTags',
        value: function hasTags(span, expectedTags) {
            // TODO(oibe) make this work for duplicate tags
            var actualTags = {};
            for (var i = 0; i < span._tags.length; i++) {
                var key = span._tags[i].key;
                actualTags[key] = span._tags[i].value;
            }

            for (var tag in expectedTags) {
                if (expectedTags.hasOwnProperty(tag) && actualTags.hasOwnProperty(tag)) {
                    if (actualTags[tag] !== expectedTags[tag]) {
                        console.log('expected tag:', expectedTags[tag], ', actual tag: ', actualTags[tag]);
                        return false;
                    }
                } else {
                    // mismatch in tag keys
                    return false;
                }
            }

            return true;
        }

        /**
         * Returns tags stored in the span. If tags with the same key are present,
         * only the last tag is returned.
         * @param {Object} span - span from which to read the tags.
         * @param {Array} [keys] - if specified, only tags with these keys are returned.
         */

    }, {
        key: 'getTags',
        value: function getTags(span, keys) {
            var actualTags = {};
            for (var i = 0; i < span._tags.length; i++) {
                var key = span._tags[i].key;
                actualTags[key] = span._tags[i].value;
            }
            if (keys) {
                var filteredTags = {};
                for (var _i = 0; _i < keys.length; _i++) {
                    var _key = keys[_i];
                    if (actualTags.hasOwnProperty(_key)) {
                        filteredTags[_key] = actualTags[_key];
                    }
                }
                return filteredTags;
            }
            return actualTags;
        }
    }]);

    return TestUtils;
}();

exports.default = TestUtils;
//# sourceMappingURL=test_util.js.map
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

var _bufferEqual = require('buffer-equal');

var _bufferEqual2 = _interopRequireDefault(_bufferEqual);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _span = require('./span.js');

var _span2 = _interopRequireDefault(_span);

var _util = require('./util.js');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TestUtils = function () {
    function TestUtils() {
        _classCallCheck(this, TestUtils);
    }

    _createClass(TestUtils, null, [{
        key: 'traceIdEqual',
        value: function traceIdEqual(span, traceId) {
            var spanTraceId = span.context().traceId;
            if (spanTraceId == null && traceId == null) {
                return true;
            }

            return (0, _bufferEqual2.default)(spanTraceId, _util2.default.encodeInt64(traceId));
        }
    }, {
        key: 'spanIdEqual',
        value: function spanIdEqual(span, spanId) {
            var spanContextId = span.context().spanId;
            if (spanContextId == null && spanId == null) {
                return true;
            }

            return (0, _bufferEqual2.default)(spanContextId, _util2.default.encodeInt64(spanId));
        }
    }, {
        key: 'parentIdEqual',
        value: function parentIdEqual(span, parentId) {
            var spanParentId = span.context().parentId;
            if (spanParentId == null && parentId == null) {
                return true;
            }

            return (0, _bufferEqual2.default)(spanParentId, _util2.default.encodeInt64(parentId));
        }
    }, {
        key: 'flagsEqual',
        value: function flagsEqual(span, flags) {
            var spanFlagsId = span.context().flags;
            return spanFlagsId === flags;
        }
    }, {
        key: 'operationNameEqual',
        value: function operationNameEqual(span, operationName) {
            return span._operationName === operationName;
        }
    }, {
        key: 'startTimeEqual',
        value: function startTimeEqual(span, startTime) {
            return span._startTime === startTime;
        }
    }, {
        key: 'durationEqual',
        value: function durationEqual(span, duration) {
            return span._duration === duration;
        }
    }, {
        key: 'hasTags',
        value: function hasTags(span, tags) {
            // TODO(oibe) make this work for duplicate tags
            var expectedTags = {};
            for (var i = 0; i < span._tags.length; i++) {
                var key = span._tags[i].key;
                var value = span._tags[i].value;
                expectedTags[key] = value;
            }

            for (var tag in tags) {
                if (tags.hasOwnProperty(tag) && !(tag in expectedTags)) {
                    return false;
                }
            }

            return true;
        }
    }, {
        key: 'hasLogs',
        value: function hasLogs(span, logs) {
            /*
            1.) This method does not work if span logs have nested objects...
            2.)  This is hard to make linear because if an object does not have a guaranteed order
                  then I cannot stringify a log, and use it as a key in a hashmap.  So its safer to compare object
                  equality with a O(n^2) which is only used for testing.
            */
            for (var i = 0; i < logs.length; i++) {
                var expectedLog = span._logs[i];
                var found = false;
                for (var j = 0; j < span._logs.length; j++) {
                    var spanLog = span._logs[j];
                    if (_lodash2.default.isEqual(spanLog, expectedLog)) {
                        found = true;
                    }
                }
                if (!found) {
                    return false;
                }
                found = false;
            }

            return true;
        }
    }, {
        key: 'isClient',
        value: function isClient(span) {
            var tag = {};
            tag[_opentracing2.default.Tags.SPAN_KIND] = _opentracing2.default.Tags.SPAN_KIND_RPC_CLIENT;
            return TestUtils.hasTags(span, tag);
        }
    }, {
        key: 'hasBaggage',
        value: function hasBaggage(span, baggage) {
            var found = false;
            for (var key in baggage) {
                found = span.getBaggageItem(key);
                if (!found) {
                    return false;
                }
            }

            return true;
        }
    }, {
        key: 'isDebug',
        value: function isDebug(span) {
            return span.context().isDebug();
        }
    }, {
        key: 'isSampled',
        value: function isSampled(span) {
            return span.context().isSampled();
        }
    }, {
        key: 'carrierHasTracerState',
        value: function carrierHasTracerState(carrier) {
            var tracerState = carrier['uber-trace-id'];
            return tracerState !== null && tracerState !== undefined;
        }
    }, {
        key: 'carrierHasBaggage',
        value: function carrierHasBaggage(carrier, baggage) {
            var prefix = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'uberctx-';

            for (var key in baggage) {
                if (baggage.hasOwnProperty(key)) {
                    var prefixKey = prefix + key;
                    if (!(prefixKey in carrier)) {
                        return false;
                    }
                }
            }

            return true;
        }
    }]);

    return TestUtils;
}();

exports.default = TestUtils;
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Copyright (c) 2017 Uber Technologies, Inc.
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

/**
 * Restriction determines whether a baggage key is allowed and contains any
 * restrictions on the baggage value.
 */
var Restriction = function () {
    function Restriction(keyAllowed, maxValueLength) {
        _classCallCheck(this, Restriction);

        this._keyAllowed = keyAllowed;
        this._maxValueLength = maxValueLength;
    }

    _createClass(Restriction, [{
        key: "keyAllowed",
        get: function get() {
            return this._keyAllowed;
        }
    }, {
        key: "maxValueLength",
        get: function get() {
            return this._maxValueLength;
        }
    }]);

    return Restriction;
}();

exports.default = Restriction;
//# sourceMappingURL=restriction.js.map
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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

var MockLogger = function () {
    function MockLogger() {
        _classCallCheck(this, MockLogger);

        this._infoMsgs = [];
        this._debugMsgs = [];
        this._warnMsgs = [];
        this._errorMsgs = [];
    }

    _createClass(MockLogger, [{
        key: "info",
        value: function info(msg) {
            this._infoMsgs.push(msg);
        }
    }, {
        key: "debug",
        value: function debug(msg) {
            this._debugMsgs.push(msg);
        }
    }, {
        key: "warn",
        value: function warn(msg) {
            this._warnMsgs.push(msg);
        }
    }, {
        key: "error",
        value: function error(msg) {
            this._errorMsgs.push(msg);
        }
    }, {
        key: "clear",
        value: function clear() {
            this._infoMsgs = [];
            this._debugMsgs = [];
            this._warnMsgs = [];
            this._errorMsgs = [];
        }
    }]);

    return MockLogger;
}();

exports.default = MockLogger;
//# sourceMappingURL=mock_logger.js.map
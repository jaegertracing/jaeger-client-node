"use strict";

var _chai = require("chai");

var _default_baggage_restriction_manager = require("../../src/baggage/default_baggage_restriction_manager");

var _default_baggage_restriction_manager2 = _interopRequireDefault(_default_baggage_restriction_manager);

var _restriction = require("../../src/baggage/restriction");

var _restriction2 = _interopRequireDefault(_restriction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('DefaultBaggageRestrictionManager should', function () {

    it('return a Restriction', function () {
        var mgr = new _default_baggage_restriction_manager2.default();
        _chai.assert.deepEqual(mgr.getRestriction("key"), new _restriction2.default(true, 2048));
    });
}); // Copyright (c) 2017 Uber Technologies, Inc.
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
//# sourceMappingURL=default_baggage_restriction_manager.js.map
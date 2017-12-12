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

var _constants = require('../constants.js');

var constants = _interopRequireWildcard(_constants);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ConstSampler = function () {
    function ConstSampler(decision) {
        _classCallCheck(this, ConstSampler);

        this._decision = decision;
    }

    _createClass(ConstSampler, [{
        key: 'name',
        value: function name() {
            return 'ConstSampler';
        }
    }, {
        key: 'toString',
        value: function toString() {
            return this.name() + '(' + (this._decision ? 'always' : 'never') + ')';
        }
    }, {
        key: 'isSampled',
        value: function isSampled(operation, tags) {
            if (this._decision) {
                tags[constants.SAMPLER_TYPE_TAG_KEY] = constants.SAMPLER_TYPE_CONST;
                tags[constants.SAMPLER_PARAM_TAG_KEY] = this._decision;
            }
            return this._decision;
        }
    }, {
        key: 'equal',
        value: function equal(other) {
            if (!(other instanceof ConstSampler)) {
                return false;
            }

            return this.decision === other.decision;
        }
    }, {
        key: 'close',
        value: function close(callback) {
            if (callback) {
                callback();
            }
        }
    }, {
        key: 'decision',
        get: function get() {
            return this._decision;
        }
    }]);

    return ConstSampler;
}();

exports.default = ConstSampler;
//# sourceMappingURL=const_sampler.js.map
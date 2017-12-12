'use strict';

var _chai = require('chai');

var _util = require('../src/util.js');

var _util2 = _interopRequireDefault(_util);

var _combinations = require('./lib/combinations.js');

var _combinations2 = _interopRequireDefault(_combinations);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('utils', function () {
    describe('ipToInt', function () {
        it('should convert malformed IP to null', function () {
            _chai.assert.isNotOk(_util2.default.ipToInt('127.0'));
        });

        it('should convert an ip less than 2^32 to an unsigned number', function () {
            _chai.assert.equal(127 << 24 | 1, _util2.default.ipToInt('127.0.0.1'));
        });

        it('should convert an ip greater than 2^32 to a negative number', function () {
            _chai.assert.equal(-1, _util2.default.ipToInt('255.255.255.255'));
        });
    });

    describe('removeLeadingZeros', function () {
        it('should leave single 0 digit intact', function () {
            _chai.assert.equal('0', _util2.default.removeLeadingZeros('0'));
        });

        it('should leave single non-0 digit intact', function () {
            _chai.assert.equal('1', _util2.default.removeLeadingZeros('1'));
        });

        it('should strip leading zeros', function () {
            _chai.assert.equal('1', _util2.default.removeLeadingZeros('0001'));
        });

        it('should convert all zeros to a single 0', function () {
            _chai.assert.equal('0', _util2.default.removeLeadingZeros('0000'));
        });
    });

    it('combinations should generate all combinations given valid parameters', function () {
        var results = (0, _combinations2.default)({ encoding: ['json', 'thrift'], mode: ['channel', 'request'] });
        var expectedTags = [{ encoding: 'json', mode: 'channel', description: 'encoding=json,mode=channel' }, { encoding: 'json', mode: 'request', description: 'encoding=json,mode=request' }, { encoding: 'thrift', mode: 'channel', description: 'encoding=thrift,mode=channel' }, { encoding: 'thrift', mode: 'request', description: 'encoding=thrift,mode=request' }];
        _chai.assert.deepEqual(expectedTags, results);
    });
});
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
//# sourceMappingURL=util.js.map
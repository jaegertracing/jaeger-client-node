// @flow
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

import {assert} from 'chai';
import Utils from '../src/util.js';
import combinations from './lib/combinations.js'

describe('utils', () => {
    describe('ipToInt', () => {
        it('should convert malformed IP to null', () => {
            assert.isNotOk(Utils.ipToInt('127.0'));
        });

        it('should convert an ip less than 2^32 to an unsigned number', () => {
            assert.equal((127 << 24) | 1, Utils.ipToInt('127.0.0.1'));
        });

        it('should convert an ip greater than 2^32 to a negative number', () => {
            assert.equal(-1, Utils.ipToInt('255.255.255.255'));
        });
    });

    describe('removeLeadingZeros', () => {
        it('should leave single 0 digit intact', () => {
            assert.equal('0', Utils.removeLeadingZeros('0'));
        });

        it('should leave single non-0 digit intact', () => {
            assert.equal('1', Utils.removeLeadingZeros('1'));
        });

        it('should strip leading zeros', () => {
            assert.equal('1', Utils.removeLeadingZeros('0001'));
        });

        it('should convert all zeros to a single 0', () => {
            assert.equal('0', Utils.removeLeadingZeros('0000'));
        });
    });

    it ('combinations should generate all combinations given valid parameters', () => {
        let results = combinations({ encoding: ['json', 'thrift'], mode: ['channel', 'request']});
        let expectedTags = [
            { encoding: 'json', mode: 'channel', description: 'encoding=json,mode=channel' },
            { encoding: 'json', mode: 'request', description: 'encoding=json,mode=request' },
            { encoding: 'thrift', mode: 'channel', description: 'encoding=thrift,mode=channel' },
            { encoding: 'thrift', mode: 'request', description: 'encoding=thrift,mode=request' }
        ];
        assert.deepEqual(expectedTags, results);
    });
});

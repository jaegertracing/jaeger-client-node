// @flow
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

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

import { assert } from 'chai';
import Utils from '../src/util.js';
import combinations from './lib/combinations.js';

describe('utils', () => {
  describe('padTraceIdStrWithZeros', () => {
    it('should return empty string for empty input', () => {
      assert.equal('', Utils.padTraceIdStrWithZeros(''));
    });

    it('should not pad string 16 characters long', () => {
      assert.equal('0123456789abcdef', Utils.padTraceIdStrWithZeros('0123456789abcdef'));
    });

    it('should not pad string 32 characters long', () => {
      assert.equal(
        '0123456789abcdef0123456789abcdef',
        Utils.padTraceIdStrWithZeros('0123456789abcdef0123456789abcdef')
      );
    });

    it('should pad string <16 characters long', () => {
      assert.equal('0000000000000123', Utils.padTraceIdStrWithZeros('123'));
    });

    it('should pad string <32 characters long', () => {
      assert.equal('0000000000000000123456789abcdef0', Utils.padTraceIdStrWithZeros('0123456789abcdef0'));
    });
  });

  it('combinations should generate all combinations given valid parameters', () => {
    let results = combinations({ encoding: ['json', 'thrift'], mode: ['channel', 'request'] });
    let expectedTags = [
      { encoding: 'json', mode: 'channel', description: 'encoding=json,mode=channel' },
      { encoding: 'json', mode: 'request', description: 'encoding=json,mode=request' },
      { encoding: 'thrift', mode: 'channel', description: 'encoding=thrift,mode=channel' },
      { encoding: 'thrift', mode: 'request', description: 'encoding=thrift,mode=request' },
    ];
    assert.deepEqual(expectedTags, results);
  });

  it('should create new empty buffer', () => {
    let results = Utils.newBuffer(8);
    assert.isNotNull(results);
    assert.equal(results.length, 8);
    assert.deepEqual(new Buffer([0, 0, 0, 0, 0, 0, 0, 0]), results);
  });

  it('should create new buffer from hex', () => {
    let expectedValue = 'deadbeef';
    let results = Utils.newBufferFromHex(expectedValue);
    assert.isNotNull(results);
    assert.equal(expectedValue, results.toString('hex'));
  });
});

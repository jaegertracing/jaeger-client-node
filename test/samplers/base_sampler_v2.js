// @flow
// Copyright (c) 2019 Uber Technologies, Inc.
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
import BaseSamplerV2 from '../../src/samplers/v2/base';

describe('BaseSamplerV2', () => {
  it('should have name()', () => {
    let s1 = new BaseSamplerV2('name1');
    assert.equal('name1', s1.name());
  });
  it('should have uniqueName()', () => {
    let s1 = new BaseSamplerV2('name');
    let s2 = new BaseSamplerV2('name');
    assert.equal('name', s1.uniqueName().substring(0, 4));
    assert.equal('name', s2.uniqueName().substring(0, 4));
    assert.notEqual(s1.uniqueName(), s2.uniqueName());
  });
  it('should throw in onCreateSpan', () => {
    let s = new BaseSamplerV2('testSampler');
    let span = {};
    assert.throw(() => s.onCreateSpan(span), Error, 'testSampler does not implement onCreateSpan');
  });
  it('should return cached decision from onSetOperation', () => {
    let s = new BaseSamplerV2('testSampler');
    let span = {};
    let d = s.onSetOperationName(span, 'operation');
    assert.equal(s._cachedDecision, d);
  });
  it('should return cached decision from onSetTag', () => {
    let s = new BaseSamplerV2('testSampler');
    let span = {};
    let d = s.onSetTag(span, 'key', 'value');
    assert.equal(s._cachedDecision, d);
  });
  it('should implement close() with callback', function(done) {
    let s = new BaseSamplerV2('testSampler');
    s.close(); // without callback
    s.close(done); // with callback
  });
});

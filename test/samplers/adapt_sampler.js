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
import adaptSampler from '../../src/samplers/_adapt_sampler';
import { adaptSamplerOrThrow } from '../../src/samplers/_adapt_sampler';
import BaseSamplerV2 from '../../src/samplers/v2/base';
import ConstSampler from '../../src/samplers/const_sampler';

describe('adaptSampler', () => {
  it('should return null for null argument', () => {
    assert.isNull(adaptSampler(null));
  });
  it('should return wrapper for v1 sampler', () => {
    let s1 = new ConstSampler(false);
    let s2: any = adaptSampler(s1);
    assert.deepEqual(s1, s2._delegate);
  });
  it('should return v2 sampler as is', () => {
    let s1 = new BaseSamplerV2('name1');
    assert.equal(s1, adaptSampler(s1));
  });
  it('should delegate toString', () => {
    let s1 = new ConstSampler(false);
    let s2: any = adaptSampler(s1);
    assert.equal(s1.toString(), s2.toString());
  });
});

describe('adaptSamplerOrThrow', () => {
  it('should throw on unrecognized sampler', () => {
    assert.throws(() => adaptSamplerOrThrow(null), Error, 'Unrecognized sampler: null');
  });
});

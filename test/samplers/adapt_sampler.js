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
// Import Tracer here to work around a weird bug that causes the error like this:
//     TypeError: Super expression must either be null or a function, not undefined
//         at _inherits (.../jaeger-client-node/src/samplers/const_sampler.js:27:113)
// The error seems to be related to a recursive import _adapt_sampler -> Span -> Tracer -> _adapt_sampler.
import Tracer from '../../src/tracer';
import * as adapter from '../../src/samplers/_adapt_sampler';
import LegacySamplerV1Base from '../../src/samplers/_adapt_sampler';
import ConstSampler from '../../src/samplers/const_sampler';
import GuaranteedThroughputSampler from '../../src/samplers/guaranteed_throughput_sampler';

describe('adaptSampler', () => {
  it('should return null for null argument', () => {
    assert.isNull(adapter.adaptSampler(null));
  });
  it('should return wrapper for v1 sampler', () => {
    let s1 = new GuaranteedThroughputSampler(0, 1.0);
    let s2: any = adapter.adaptSampler(s1);
    assert.deepEqual(s1, s2._delegate);
  });
  it('should return v2 sampler as is', () => {
    let s1 = new ConstSampler(true);
    assert.equal(s1, adapter.adaptSampler(s1));
  });
  it('should delegate toString', () => {
    let s1 = new GuaranteedThroughputSampler(0, 1.0);
    let s2: any = adapter.adaptSampler(s1);
    assert.equal(s1.toString(), s2.toString());
  });
});

describe('adaptSamplerOrThrow', () => {
  it('should throw on unrecognized sampler', () => {
    assert.throws(() => adapter.adaptSamplerOrThrow(null), Error, 'Unrecognized sampler: null');
  });
});

describe('LegacySamplerV1Base', () => {
  it('should throw in isSampled', () => {
    let c = new LegacySamplerV1Base('test');
    assert.throws(() => c.isSampled('op1', {}), Error, 'Subclass must override isSampled()');
  });
});

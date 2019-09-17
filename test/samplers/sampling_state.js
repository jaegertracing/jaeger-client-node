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
import SamplingState from '../../src/samplers/v2/sampling_state';
import SpanContext from '../../src/span_context';

describe('SamplingState', () => {
  it('should support extendedState', () => {
    let s = new SamplingState();
    let es = s.extendedState();
    es['sithlord'] = { 'something, something': 'dark force' };
    assert.equal('dark force', s.extendedState()['sithlord']['something, something']);
  });
  it('should recognize local root span', () => {
    let s = new SamplingState('00000000000id123');
    assert.equal('00000000000id123', s.localRootSpanId());
    let ctx1 = SpanContext.withStringIds('', 'id123', null, 0);
    let ctx2 = SpanContext.withStringIds('', 'id12345', null, 0);
    assert.equal(true, s.isLocalRootSpan(ctx1));
    assert.equal(false, s.isLocalRootSpan(ctx2));
  });
  it('should support isLocal state', () => {
    let s = new SamplingState();
    assert.equal(false, s.isFinal());
    s.setFinal(true);
    assert.equal(true, s.isFinal());
    s.setFinal(false);
    assert.equal(false, s.isFinal());
  });
  it('should support firehose flag', () => {
    let s = new SamplingState();
    assert.equal(false, s.isFirehose());
    s.setFirehose(true);
    assert.equal(true, s.isFirehose());
    assert.equal(8, s.flags());
    s.setFirehose(false);
    assert.equal(false, s.isFirehose());
    assert.equal(0, s.flags());
  });
});

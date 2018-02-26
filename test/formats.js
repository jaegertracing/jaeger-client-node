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

import { assert, expect } from 'chai';
import { FORMAT_BINARY, FORMAT_TEXT_MAP, FORMAT_HTTP_HEADERS } from '../src/formats';
import opentracing from 'opentracing';

describe('formats', () => {
  it('FORMAT_BINARY should be opentracing constant FORMAT_BINARY', () => {
    expect(FORMAT_BINARY).to.be.equal(opentracing.FORMAT_BINARY);
  });

  it('FORMAT_TEXT_MAP should be opentracing constant FORMAT_TEXT_MAP', () => {
    expect(FORMAT_TEXT_MAP).to.equal(opentracing.FORMAT_TEXT_MAP);
  });

  it('FORMAT_HTTP_HEADERS should be opentracing constant FORMAT_HTTP_HEADERS', () => {
    expect(FORMAT_HTTP_HEADERS).to.equal(opentracing.FORMAT_HTTP_HEADERS);
  });
});

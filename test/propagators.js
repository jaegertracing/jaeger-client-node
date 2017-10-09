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
import TextMapCodec from '../src/propagators/text_map_codec';
import SpanContext from '../src/span_context';

describe ('TextMapCodec', () => {
    it('should not URL-decode value that has no % meta-characters', () => {
        let codec = new TextMapCodec({ urlEncoding: true });
        codec._decodeURIValue = (value: string) => {
            throw new URIError('fake error');
        };
        assert.strictEqual(codec._decodeValue('abc'), 'abc');
    });

    it('should not throw exception on bad URL-encoded values', () => {
        let codec = new TextMapCodec({ urlEncoding: true });
        // this string throws exception when passed to decodeURIComponent
        assert.strictEqual(codec._decodeValue('%EA'), '%EA');
    });

    it('should not URL-encode span context', () => {
        let codec = new TextMapCodec({ urlEncoding: true, contextKey: 'trace-context' });
        let ctx = SpanContext.fromString('1:1:1:1');
        let out = {};
        codec.inject(ctx, out);
        assert.strictEqual(out['trace-context'], '1:1:1:1');
    });

    it('should decode baggage', () => {
        let codec = new TextMapCodec({ 
            urlEncoding: true, 
            contextKey: 'trace-context',
            baggagePrefix: 'baggage-'
        });
        let carrier = {
            'trace-context': '1:1:1:1',
            'baggage-some-key': 'some-value',
            'garbage-in': 'garbage-out'
        };
        let ctx = codec.extract(carrier);
        assert.deepEqual(ctx.baggage, { 'some-key': 'some-value' });
    });
});

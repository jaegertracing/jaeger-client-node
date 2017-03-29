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

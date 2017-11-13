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
import * as constants from '../src/constants';
import TextMapCodec from '../src/propagators/text_map_codec';
import ZipkinB3TextMapCodec from '../src/propagators/zipkin_b3_text_map_codec';
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

describe ('ZipkinB3TextMapCodec', () => {
    it('correctly extract the zipkin headers from a span context', () => {
        let codec = new ZipkinB3TextMapCodec({ urlEncoding: true });

        let carrier = {
            'x-b3-parentspanid': 'some-parent',
            'x-b3-spanid': 'some-span',
            'x-b3-traceid': 'some-trace',
            'x-b3-sampled': '1',
            'x-b3-flags': '1',
            'foo': 'bar'
        };

        let ctx = codec.extract(carrier);
        assert.equal(ctx.parentId, 'some-parent');
        assert.equal(ctx.spanId, 'some-span');
        assert.equal(ctx.traceId, 'some-trace');
        assert.equal(ctx.isSampled(), true);
        assert.equal(ctx.isDebug(), true);
    });

    it('correctly inject the zipkin headers into a span context', () => {
        let codec = new ZipkinB3TextMapCodec({ urlEncoding: true });
        let carrier = {};

        let ctx = SpanContext.withStringIds('some-trace', 'some-span', 'some-parent');
        ctx.flags = constants.DEBUG_MASK | constants.SAMPLED_MASK;

        codec.inject(ctx, carrier);
        assert.equal(carrier['x-b3-traceid'], 'some-trace');
        assert.equal(carrier['x-b3-spanid'], 'some-span');
        assert.equal(carrier['x-b3-parentspanid'], 'some-parent');
        assert.equal(carrier['x-b3-flags'], '1');

        // > Since Debug implies Sampled, so don't also send "X-B3-Sampled: 1"
        // https://github.com/openzipkin/b3-propagation
        assert.isUndefined(carrier['x-b3-sampled']);
    });

    it('should not URL-decode value that has no % meta-characters', () => {
        let codec = new ZipkinB3TextMapCodec({ urlEncoding: true });
        codec._decodeURIValue = (value: string) => {
            throw new URIError('fake error');
        };
        assert.strictEqual(codec._decodeValue('abc'), 'abc');
    });

    it('should not throw exception on bad URL-encoded values', () => {
        let codec = new ZipkinB3TextMapCodec({ urlEncoding: true });
        // this string throws exception when passed to decodeURIComponent
        assert.strictEqual(codec._decodeValue('%EA'), '%EA');
    });

    it('should decode baggage', () => {
        let codec = new ZipkinB3TextMapCodec({
            urlEncoding: true,
            contextKey: 'trace-context',
            baggagePrefix: 'baggage-'
        });
        let carrier = {
            'x-b3-parentspanid': 'some-parent',
            'x-b3-spanid': 'some-span',
            'x-b3-traceid': 'some-trace',
            'baggage-some-key': 'some-value',
            'garbage-in': 'garbage-out'
        };
        let ctx = codec.extract(carrier);
        assert.deepEqual(ctx.baggage, { 'some-key': 'some-value' });
    });

    it('should encode baggage', () => {
        let codec = new ZipkinB3TextMapCodec({
            urlEncoding: true,
            contextKey: 'trace-context',
            baggagePrefix: 'baggage-'
        });
        let carrier = {};

        let ctx = SpanContext.withStringIds('some-trace', 'some-span', 'some-parent');
        ctx = ctx.withBaggageItem('some-key', 'some-value');
        ctx = ctx.withBaggageItem('another-key', 'another-value');

        codec.inject(ctx, carrier);
        assert.equal(carrier['baggage-some-key'], 'some-value');
        assert.equal(carrier['baggage-another-key'], 'another-value');
    });
});

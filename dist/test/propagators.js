'use strict';

var _chai = require('chai');

var _constants = require('../src/constants');

var constants = _interopRequireWildcard(_constants);

var _text_map_codec = require('../src/propagators/text_map_codec');

var _text_map_codec2 = _interopRequireDefault(_text_map_codec);

var _zipkin_b3_text_map_codec = require('../src/propagators/zipkin_b3_text_map_codec');

var _zipkin_b3_text_map_codec2 = _interopRequireDefault(_zipkin_b3_text_map_codec);

var _span_context = require('../src/span_context');

var _span_context2 = _interopRequireDefault(_span_context);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

describe('TextMapCodec', function () {
    it('should not URL-decode value that has no % meta-characters', function () {
        var codec = new _text_map_codec2.default({ urlEncoding: true });
        codec._decodeURIValue = function (value) {
            throw new URIError('fake error');
        };
        _chai.assert.strictEqual(codec._decodeValue('abc'), 'abc');
    });

    it('should not throw exception on bad URL-encoded values', function () {
        var codec = new _text_map_codec2.default({ urlEncoding: true });
        // this string throws exception when passed to decodeURIComponent
        _chai.assert.strictEqual(codec._decodeValue('%EA'), '%EA');
    });

    it('should not URL-encode span context', function () {
        var codec = new _text_map_codec2.default({ urlEncoding: true, contextKey: 'trace-context' });
        var ctx = _span_context2.default.fromString('1:1:1:1');
        var out = {};
        codec.inject(ctx, out);
        _chai.assert.strictEqual(out['trace-context'], '1:1:1:1');
    });

    it('should decode baggage', function () {
        var codec = new _text_map_codec2.default({
            urlEncoding: true,
            contextKey: 'trace-context',
            baggagePrefix: 'baggage-'
        });
        var carrier = {
            'trace-context': '1:1:1:1',
            'baggage-some-key': 'some-value',
            'garbage-in': 'garbage-out'
        };
        var ctx = codec.extract(carrier);
        _chai.assert.deepEqual(ctx.baggage, { 'some-key': 'some-value' });
    });
}); // Copyright (c) 2016 Uber Technologies, Inc.
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

describe('ZipkinB3TextMapCodec', function () {
    it('correctly extract the zipkin headers from a span context', function () {
        var codec = new _zipkin_b3_text_map_codec2.default({ urlEncoding: true });

        var carrier = {
            'x-b3-parentspanid': '123abc',
            'x-b3-spanid': 'aaafff',
            'x-b3-traceid': '789fed',
            'x-b3-sampled': '1',
            'x-b3-flags': '1',
            'foo': 'bar'
        };

        var ctx = codec.extract(carrier);
        _chai.assert.equal(ctx.parentIdStr, '123abc');
        _chai.assert.equal(ctx.spanIdStr, 'aaafff');
        _chai.assert.equal(ctx.traceIdStr, '789fed');
        _chai.assert.equal(ctx.isSampled(), true);
        _chai.assert.equal(ctx.isDebug(), true);
    });

    it('use an empty context if the zipkin headers contain invalid ids', function () {
        var codec = new _zipkin_b3_text_map_codec2.default({ urlEncoding: true });

        var carrier = {
            'x-b3-parentspanid': 'bad-value',
            'x-b3-spanid': 'another-bad-value',
            'x-b3-traceid': 'not-a-valid-traceid',
            'x-b3-sampled': '1',
            'x-b3-flags': '1',
            'foo': 'bar'
        };

        var ctx = codec.extract(carrier);
        _chai.assert.isNotOk(ctx.parentIdStr);
        _chai.assert.isNotOk(ctx.spanIdStr);
        _chai.assert.isNotOk(ctx.traceIdStr);
        _chai.assert.equal(ctx.isSampled(), true);
        _chai.assert.equal(ctx.isDebug(), true);
    });
    it('correctly inject the zipkin headers into a span context', function () {
        var codec = new _zipkin_b3_text_map_codec2.default({ urlEncoding: true });
        var carrier = {};

        var ctx = _span_context2.default.withStringIds('789fed', 'aaafff', '123abc');
        ctx.flags = constants.DEBUG_MASK | constants.SAMPLED_MASK;

        codec.inject(ctx, carrier);
        _chai.assert.equal(carrier['x-b3-traceid'], '789fed');
        _chai.assert.equal(carrier['x-b3-spanid'], 'aaafff');
        _chai.assert.equal(carrier['x-b3-parentspanid'], '123abc');
        _chai.assert.equal(carrier['x-b3-flags'], '1');

        // > Since Debug implies Sampled, so don't also send "X-B3-Sampled: 1"
        // https://github.com/openzipkin/b3-propagation
        _chai.assert.isUndefined(carrier['x-b3-sampled']);
    });

    it('should not URL-decode value that has no % meta-characters', function () {
        var codec = new _zipkin_b3_text_map_codec2.default({ urlEncoding: true });
        codec._decodeURIValue = function (value) {
            throw new URIError('fake error');
        };
        _chai.assert.strictEqual(codec._decodeValue('abc'), 'abc');
    });

    it('should not throw exception on bad URL-encoded values', function () {
        var codec = new _zipkin_b3_text_map_codec2.default({ urlEncoding: true });
        // this string throws exception when passed to decodeURIComponent
        _chai.assert.strictEqual(codec._decodeValue('%EA'), '%EA');
    });

    it('should decode baggage', function () {
        var codec = new _zipkin_b3_text_map_codec2.default({
            urlEncoding: true,
            contextKey: 'trace-context',
            baggagePrefix: 'baggage-'
        });
        var carrier = {
            'x-b3-parentspanid': '123abc',
            'x-b3-spanid': 'aaafff',
            'x-b3-traceid': '789fed',
            'baggage-some-key': 'some-value',
            'garbage-in': 'garbage-out'
        };
        var ctx = codec.extract(carrier);
        _chai.assert.deepEqual(ctx.baggage, { 'some-key': 'some-value' });
    });

    it('should encode baggage', function () {
        var codec = new _zipkin_b3_text_map_codec2.default({
            urlEncoding: true,
            contextKey: 'trace-context',
            baggagePrefix: 'baggage-'
        });
        var carrier = {};

        var ctx = _span_context2.default.withStringIds('789fed', 'aaafff', '123abc');
        ctx = ctx.withBaggageItem('some-key', 'some-value');
        ctx = ctx.withBaggageItem('another-key', 'another-value');

        codec.inject(ctx, carrier);
        _chai.assert.equal(carrier['baggage-some-key'], 'some-value');
        _chai.assert.equal(carrier['baggage-another-key'], 'another-value');
    });
});
//# sourceMappingURL=propagators.js.map
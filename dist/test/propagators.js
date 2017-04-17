'use strict';

var _chai = require('chai');

var _text_map_codec = require('../src/propagators/text_map_codec');

var _text_map_codec2 = _interopRequireDefault(_text_map_codec);

var _span_context = require('../src/span_context');

var _span_context2 = _interopRequireDefault(_span_context);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
//# sourceMappingURL=propagators.js.map
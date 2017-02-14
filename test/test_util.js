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
import ConstSampler from '../src/samplers/const_sampler.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import opentracing from 'opentracing';
import SpanContext from '../src/span_context.js';
import Tracer from '../src/tracer.js';
import TestUtils from '../src/test_util.js';
import Utils from '../src/util.js';

describe('TestUtils', () => {
    let tracer;
    let span;
    let spanContext;

    before(() => {
        tracer = new Tracer(
            'test-tracer',
            new InMemoryReporter(),
            new ConstSampler(true)
        );
    });

    beforeEach(() => {
        span = tracer.startSpan('op-name');
        spanContext = SpanContext.fromString('ab:cd:ef:3');
    });

    it ('should support hasTags', () => {
        let tags = {
            'keyOne': 'valueOne',
            'keyTwo': 'valueTwo'
        };
        span.addTags(tags);

        assert.isOk(TestUtils.hasTags(span, tags));
        assert.isNotOk(TestUtils.hasTags(span, { 'k': 'v' }));
        assert.isNotOk(TestUtils.hasTags(span, { 'keyOne': 'valueTwo' }));
    });

    it ('should support getTags', () => {
        let expectedTags = {
            'keyOne': 'valueOne',
            'keyTwo': 'valueTwo'
        };
        span.addTags(expectedTags);
        let actualTags = TestUtils.getTags(span);
        assert.equal(actualTags['keyOne'], expectedTags['keyOne']);
        assert.equal(actualTags['keyTwo'], expectedTags['keyTwo']);
        let filteredTags = TestUtils.getTags(span, ['keyTwo', 'keyThree']);
        assert.deepEqual({'keyTwo': 'valueTwo'}, filteredTags);
    });
});

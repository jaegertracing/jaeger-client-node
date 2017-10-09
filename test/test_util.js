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

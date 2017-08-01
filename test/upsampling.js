// Copyright (c) 2017 Uber Technologies, Inc.
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

import _ from 'lodash';
import {assert, expect} from 'chai';
import ConstSampler from '../src/samplers/const_sampler.js';
import * as constants from '../src/constants.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import MockLogger from './lib/mock_logger';
import Span from '../src/span.js';
import SpanContext from '../src/span_context.js';
import sinon from 'sinon';
import Tracer from '../src/tracer.js';
import Utils from '../src/util.js';

describe('span upsampling', () => {
    let reporter = new InMemoryReporter();
    let tracer;
    let span;
    let spanContext;

    beforeEach(() => {
        tracer = new Tracer(
            'test-service-name',
            reporter,
            new ConstSampler(true),
            { logger : new MockLogger(), upsampling : { enabled : true } }
        );

        spanContext = SpanContext.withBinaryIds(
            Utils.encodeInt64(1),
            Utils.encodeInt64(2),
            null,
            constants.SAMPLED_MASK
        );

        span = new Span(
            tracer,
            'op-name',
            spanContext,
            tracer.now()
        );
    });

    let baseCase = {
        flags    : 0,
        original : {
            operationName    : 'originalOperation',
            samplingDecision : false,
        },
        new : {
            operationName    : 'newOperation',
            samplingDecision : true,
        },
        finalSamplingDecision : true,
    };

    let testCases = [
        {
            name  : 'for false sampling decision',
            value : _.defaults({ original : { samplingDecision : false } }, baseCase),
        },
        {
            name  : 'for true sampling decision',
            value : _.defaults({ original : { samplingDecision : true } }, baseCase),
        },
        {
            name  : 'on operation name change, modify sampling decision 0 -> 0, verify final decision 0',
            value : _.defaults({
                original              : { samplingDecision : false },
                new                   : { samplingDecision : false },
                finalSamplingDecision : false,
            }, baseCase),
        },
        {
            name  : 'on operation name change, modify sampling decision 0 -> 1, verify final decision 1',
            value : _.defaults({
                original : { samplingDecision : false },
                new      : { samplingDecision : true },
            }, baseCase),
        },
        {
            // This is because changing the operation name can only cause an unsampled span to be
            // sampled and not vice-versa
            name  : 'on operation name change, modify sampling decision 1 -> 0, verify final decision 1',
            value : _.defaults({
                original : { samplingDecision : true },
                new      : { samplingDecision : false },
            }, baseCase),
        },
        {
            name  : 'on operation name change, modify sampling decision 1 -> 1, verify final decision 1',
            value : _.defaults({
                original : { samplingDecision : true },
                new      : { samplingDecision : true },
            }, baseCase),
        },

    ];

    describe('unsampled spans should call sampler', () => {
        function testCallSampler(name, testCase) {
            it(name, () => {
                spanContext._flags = testCase.flags;

                let mockSampler = sinon.mock(tracer._sampler);
                mockSampler.expects('isSampled')
                    .withExactArgs(testCase.original.operationName, {})
                    .returns(testCase.original.samplingDecision);

                let child = tracer.startSpan(testCase.original.operationName,
                                             { childOf : span.context() });

                mockSampler.verify();
                assert.equal((child.context().isSampled() || child.context().isDebug()),
                             testCase.original.samplingDecision);
            });
        }

        function testCallSamplerOnOperationNameChange(name, testCase) {
            it(name, () => {
                spanContext._flags = testCase.flags;

                let mockSampler = sinon.mock(tracer._sampler);
                mockSampler.expects('isSampled')
                    .withExactArgs(testCase.original.operationName, {})
                    .returns(testCase.original.samplingDecision);
                mockSampler.expects('isSampled').withExactArgs(testCase.new.operationName, {})
                    .returns(testCase.new.samplingDecision);

                let child = tracer.startSpan(testCase.original.operationName,
                                             { childOf : span.context() });
                child.setOperationName(testCase.new.operationName);

                mockSampler.verify();
                assert.equal((child.context().isSampled() || child.context().isDebug()),
                             testCase.finalSamplingDecision);
            });
        }
        testCallSampler(testCases[0].name, testCases[0].value);
        testCallSampler(testCases[1].name, testCases[1].value);

        for (let i = 2; i < testCases.length; i++) {
            testCallSamplerOnOperationNameChange(testCases[i].name, testCases[i].value);
        }
    });

    function testNoSamplerCalls(name, testCase) {
        it(name, () => {
            spanContext._flags = testCase.flags;

            let mockSampler = sinon.mock(tracer._sampler);
            let child = tracer.startSpan(testCase.original.operationName,
                                         { childOf : span.context() });

            mockSampler.verify();
            assert.equal((child.context().isSampled() || child.context().isDebug()), true);
        });
    }

    describe('sampled spans should not call sampler', () => {
        testCases.forEach(testCase => {
            testNoSamplerCalls(testCase.name,
                               _.defaults({ flags : constants.SAMPLED_MASK }, testCase.value));
        });
    });

    describe('debug spans should not call sampler', () => {
        testCases.forEach(testCase => {
            testNoSamplerCalls(testCase.name,
                               _.defaults({ flags : constants.DEBUG_MASK }, testCase.value));
        });
    });

    describe('debug and sampled spans should not call sampler', () => {
        testCases.forEach(testCase => {
            testNoSamplerCalls(testCase.name,
                               _.defaults(
                                   { flags : constants.DEBUG_MASK || constants.SAMPLED_MASK },
                                   testCase.value));
        });
    });

    describe('nested children', () => {
        function testUpsampling(samplingDecision) {
            spanContext._flags = 0;
            let mockSampler = sinon.mock(tracer._sampler);
            mockSampler.expects('isSampled')
                .withExactArgs('operationName', {})
                .returns(samplingDecision);

            let child1 = tracer.startSpan('operationName',
                                          { childOf : span.context() });

            mockSampler.verify();
            assert.equal(samplingDecision, child1.context().isSampled());

            let child2 = tracer.startSpan('blah', { childOf : child1.context() });
            mockSampler.verify();
            assert.equal(samplingDecision, child2.context().isSampled());

            let child3 = tracer.startSpan('boom', { childOf : child2.context() });
            mockSampler.verify();
            assert.equal(samplingDecision, child3.context().isSampled());
        }

        it('should reuse parent decision when sampling is true', () => {
            testUpsampling(true);
        });

        it('should reuse parent decision when sampling is false', () => {
            testUpsampling(false);
        });
    });
});


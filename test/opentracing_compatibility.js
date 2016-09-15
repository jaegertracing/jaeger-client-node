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

import apiCompatibilityChecks from 'opentracing/test/api_compatibility.js';
import {assert} from 'chai';
import ConstSampler from '../src/samplers/const_sampler.js';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import * as opentracing from 'opentracing';
import Tracer from '../src/tracer';

describe('Jaeger Tracer', () => {
    it('is compatible with opentracing', () => {
        apiCompatibilityChecks(() => {
            return new Tracer(
                'test-tracer',
                new InMemoryReporter(),
                new ConstSampler(true)
            );
        }, {'checkBaggageValues' : true });
    });
});

// @flow
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

declare interface Sampler {
    name(): string;
    
    /**
     * Decides if a new trace starting with given operation name
     * should be sampled or not. If the method returns true, it
     * must populate the tags dictionary with tags that identify
     * the sampler, namely sampler.type and sampler.param.
     *
     * This API is different from Python and Go, because Javascipt
     * does not allow functions to return multiple values. We would
     * have to return an object like {sampled: bool, tags: map},
     * which would require heap allocation every time, and in most
     * cases will have sampled=false where tags are irrelevant.
     * By passing tags as an out parameter we can minimize the
     * allocations.
     *
     * @param {string} operation - Operation name of the root span.
     * @param {Object} tags - output dictionary to store sampler tags.
     * @return {boolean} - returns whether the trace should be sampled.
     * 
     */
    isSampled(operation: string, tags: any): boolean;

    equal(other: Sampler): boolean;

    close(callback: ?Function): void;
}

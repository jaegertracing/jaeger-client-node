// @flow
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

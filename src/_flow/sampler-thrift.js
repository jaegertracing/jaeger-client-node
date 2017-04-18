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

declare type ProbabilisticSamplingStrategy = {
    samplingRate: number
};

declare type RateLimitingSamplingStrategy = {
    maxTracesPerSecond: number
};

// OperationSamplingStrategy defines a sampling strategy for a given operation
// that randomly samples a fixed percentage of traces.
declare type OperationSamplingStrategy = {
    operation: string,
    probabilisticSampling: ProbabilisticSamplingStrategy
};

// PerOperationSamplingStrategies defines a collection of sampling strategies
// per operation name, and a pair of parameters for the default sampling strategy
// applicable to unknown operation names.
declare type PerOperationSamplingStrategies = {
    defaultSamplingProbability: number,
    defaultLowerBoundTracesPerSecond: number,
    perOperationStrategies: Array<OperationSamplingStrategy>
}

declare type SamplingStrategyResponse = {
    strategyType: string,
    probabilisticSampling?: ProbabilisticSamplingStrategy,
    rateLimitingSampling?: RateLimitingSamplingStrategy,
    operationSampling?: PerOperationSamplingStrategies
};

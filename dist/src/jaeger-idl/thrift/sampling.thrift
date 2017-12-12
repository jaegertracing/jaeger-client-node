# The MIT License (MIT)
# 
# Copyright (c) 2016 Uber Technologies, Inc.
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.

namespace java com.uber.jaeger.thrift.sampling_manager

enum SamplingStrategyType { PROBABILISTIC, RATE_LIMITING }

// ProbabilisticSamplingStrategy randomly samples a fixed percentage of all traces.
struct ProbabilisticSamplingStrategy {
    1: required double samplingRate // percentage expressed as rate (0..1]
}

// RateLimitingStrategy samples traces with a rate that does not exceed specified number of traces per second.
// The recommended implementation approach is leaky bucket.
struct RateLimitingSamplingStrategy {
    1: required i16 maxTracesPerSecond
}

// OperationSamplingStrategy defines a sampling strategy that randomly samples a fixed percentage of operation traces.
struct OperationSamplingStrategy {
    1: required string operation
    2: required ProbabilisticSamplingStrategy probabilisticSampling
}

// PerOperationSamplingStrategies defines a sampling strategy per each operation name in the service
// with a guaranteed lower bound per second. Once the lower bound is met, operations are randomly sampled
// at a fixed percentage.
struct PerOperationSamplingStrategies {
    1: required double defaultSamplingProbability
    2: required double defaultLowerBoundTracesPerSecond
    3: required list<OperationSamplingStrategy> perOperationStrategies
    4: optional double defaultUpperBoundTracesPerSecond
}

struct SamplingStrategyResponse {
    1: required SamplingStrategyType strategyType
    2: optional ProbabilisticSamplingStrategy probabilisticSampling
    3: optional RateLimitingSamplingStrategy rateLimitingSampling
    4: optional PerOperationSamplingStrategies operationSampling
}

service SamplingManager {
    SamplingStrategyResponse getSamplingStrategy(1: string serviceName)
}

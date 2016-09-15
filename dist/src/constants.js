'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
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

// SAMPLED_MASK is the bit mask indicating that a span has been sampled.
var SAMPLED_MASK = exports.SAMPLED_MASK = 0x1;

// DEBUG_MASK is the bit mask indicationg that a span has been marked for debug.
var DEBUG_MASK = exports.DEBUG_MASK = 0x2;

// JAEGER_CLIENT_VERSION_TAG_KEY is the name of the tag used to report client version.
var JAEGER_CLIENT_VERSION_TAG_KEY = exports.JAEGER_CLIENT_VERSION_TAG_KEY = 'jaeger.version';

// TRACER_HOSTNAME_TAG_KEY used to report host name of the process.
var TRACER_HOSTNAME_TAG_KEY = exports.TRACER_HOSTNAME_TAG_KEY = 'jaeger.hostname';

// SAMPLER_TYPE_TAG_KEY reports which sampler was used on the root span.
var SAMPLER_TYPE_TAG_KEY = exports.SAMPLER_TYPE_TAG_KEY = 'sampler.type';

// SAMPLER_PARAM_TAG_KEY reports which sampler was used on the root span.
var SAMPLER_PARAM_TAG_KEY = exports.SAMPLER_PARAM_TAG_KEY = 'sampler.param';

// SAMPLER_TYPE_CONST is the type of the sampler that always makes the same decision.
var SAMPLER_TYPE_CONST = exports.SAMPLER_TYPE_CONST = 'const';

// SAMPLER_TYPE_PROBABILISTIC is the type of sampler that samples traces
// with a certain fixed probability.
var SAMPLER_TYPE_PROBABILISTIC = exports.SAMPLER_TYPE_PROBABILISTIC = 'probabilistic';

// SAMPLER_TYPE_RATE_LIMITING is the type of sampler that samples
// only up to a fixed number of traces per second.
var SAMPLER_TYPE_RATE_LIMITING = exports.SAMPLER_TYPE_RATE_LIMITING = 'ratelimiting';

// SAMPLER_TYPE_REMOTE is the type of sampler that polls Jaeger agent for sampling strategy.
var SAMPLER_TYPE_REMOTE = exports.SAMPLER_TYPE_REMOTE = "remote";
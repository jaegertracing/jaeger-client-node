'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
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

// SAMPLED_MASK is the bit mask indicating that a span has been sampled.
var SAMPLED_MASK = exports.SAMPLED_MASK = 0x1;

// DEBUG_MASK is the bit mask indicationg that a span has been marked for debug.
var DEBUG_MASK = exports.DEBUG_MASK = 0x2;

// JAEGER_CLIENT_VERSION_TAG_KEY is the name of the tag used to report client version.
var JAEGER_CLIENT_VERSION_TAG_KEY = exports.JAEGER_CLIENT_VERSION_TAG_KEY = 'jaeger.version';

// TRACER_HOSTNAME_TAG_KEY used to report host name of the process.
var TRACER_HOSTNAME_TAG_KEY = exports.TRACER_HOSTNAME_TAG_KEY = 'jaeger.hostname';

// PROCESS_IP used to report ip of the process.
var PROCESS_IP = exports.PROCESS_IP = 'ip';

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

// SAMPLER_TYPE_LOWER_BOUND is the type of sampler that samples
// only up to a fixed number of traces per second.
var SAMPLER_TYPE_LOWER_BOUND = exports.SAMPLER_TYPE_LOWER_BOUND = "lowerbound";

// SAMPLER_TYPE_REMOTE is the type of sampler that polls Jaeger agent for sampling strategy.
var SAMPLER_TYPE_REMOTE = exports.SAMPLER_TYPE_REMOTE = 'remote';

// JAEGER_DEBUG_HEADER is the name of an HTTP header or a TextMap carrier key which,
// if found in the carrier, forces the trace to be sampled as "debug" trace.
// The value of the header is recorded as the tag on the root span, so that the
// trace can be found in the UI using this value as a correlation ID.
var JAEGER_DEBUG_HEADER = exports.JAEGER_DEBUG_HEADER = 'jaeger-debug-id';

// JaegerBaggageHeader is the name of the HTTP header that is used to submit baggage.
// It differs from TraceBaggageHeaderPrefix in that it can be used only in cases where
// a root span does not exist.
var JAEGER_BAGGAGE_HEADER = exports.JAEGER_BAGGAGE_HEADER = "jaeger-baggage";

// TRACER_BAGGAGE_HEADER_PREFIX is the default prefix used for saving baggage to a carrier.
var TRACER_BAGGAGE_HEADER_PREFIX = exports.TRACER_BAGGAGE_HEADER_PREFIX = 'uberctx-';

// TRACER_STATE_HEADER_NAME is the header key used for a span's serialized context.
var TRACER_STATE_HEADER_NAME = exports.TRACER_STATE_HEADER_NAME = 'uber-trace-id';
//# sourceMappingURL=constants.js.map
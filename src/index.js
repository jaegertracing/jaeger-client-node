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

import Configuration from './configuration';

import SpanContext from './span_context';
import Span from './span';
import Tracer from './tracer';

import ConstSampler from './samplers/const_sampler';
import ProbabilisticSampler from './samplers/probabilistic_sampler';
import RateLimitingSampler from './samplers/ratelimiting_sampler';
import RemoteSampler from './samplers/remote_sampler';

import CompositeReporter from './reporters/composite_reporter';
import InMemoryReporter from './reporters/in_memory_reporter';
import LoggingReporter from './reporters/logging_reporter';
import NoopReporter from './reporters/noop_reporter';
import RemoteReporter from './reporters/remote_reporter';

import TextMapCodec from './propagators/text_map_codec';
import ZipkinB3TextMapCodec from './propagators/zipkin_b3_text_map_codec';

import TestUtils from './test_util';
import TChannelBridge from './tchannel_bridge';

import * as opentracing from 'opentracing';

module.exports = {
  Configuration,
  initTracer: Configuration.initTracer,
  SpanContext,
  Span,
  Tracer,

  ConstSampler,
  ProbabilisticSampler,
  RateLimitingSampler,
  RemoteSampler,

  CompositeReporter,
  InMemoryReporter,
  LoggingReporter,
  NoopReporter,
  RemoteReporter,

  TextMapCodec,
  ZipkinB3TextMapCodec,

  TestUtils,
  TChannelBridge,
  opentracing,
};

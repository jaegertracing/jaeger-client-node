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

import { expect } from "chai";
import entrypoint from "../../entrypoint";

describe("entrypoint", () => {
  it("should import and create objects without error", () => {
    expect(entrypoint.initTracer).to.be.a("function");
    expect(entrypoint.ConstSampler).to.be.a("function");
    expect(entrypoint.ProbabilisticSampler).to.be.a("function");
    expect(entrypoint.RateLimitingSampler).to.be.a("function");
    expect(entrypoint.RemoteSampler).to.be.a("function");
    expect(entrypoint.CompositeReporter).to.be.a("function");
    expect(entrypoint.InMemoryReporter).to.be.a("function");
    expect(entrypoint.LoggingReporter).to.be.a("function");
    expect(entrypoint.NoopReporter).to.be.a("function");
    expect(entrypoint.RemoteReporter).to.be.a("function");
    expect(entrypoint.TestUtils).to.be.a("function");
    expect(entrypoint.SpanContext).to.be.a("function");
    expect(entrypoint.TChannelBridge).to.be.a("function");
    expect(entrypoint.opentracing).to.be.a("object");
  });
});

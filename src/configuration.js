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


import SpanContext from './span_context';
import Span from './span';
import ConstSampler from './samplers/const_sampler';
import InMemoryReporter from './reporters/in_memory_reporter';
import ProbabilisticSampler from './samplers/probabilistic_sampler';
import RateLimitingSampler from './samplers/ratelimiting_sampler';
import RemoteReporter from './reporters/remote_reporter';
import CompositeReporter from './reporters/composite_reporter';
import LoggingReporter from './reporters/logging_reporter';
import RemoteSampler from './samplers/remote_sampler';
import Tracer from './tracer';
import UDPSender from './reporters/udp_sender';
import opentracing from 'opentracing';

export default class Configuration {

    static _getSampler(serviceName: string, config: SamplerConfig): Sampler {
        let type: string = config.type;
        let param: number = config.param;

        let sampler;
        if (type === 'probabilistic') {
            sampler = new ProbabilisticSampler(param);
        }

        if (type === 'ratelimiting') {
            sampler = new RateLimitingSampler(param);
        }

        if (type === 'const') {
            sampler = new ConstSampler(param === 1);
        }

        if (type === 'remote') {
            sampler = new RemoteSampler(serviceName, {
                sampler: new ProbabilisticSampler(param)
            });
        }

        if (!sampler) {
            sampler = new ProbabilisticSampler(0.001);
        }

        return sampler;
    }

    static _getReporter(config: ReporterConfig, options: ReporterOptions): Reporter {
        let sender: Sender;
        let reporterOptions: any = {};
        let reporter: Reporter;
        let hostPort: string = '';
        if (config) {
            if (config.flushIntervalMs) {
                reporterOptions['flushIntervalMs'] = config.flushIntervalMs;
            }

            if (config.agentHost && config.agentPort) {
                hostPort = `${config.agentHost}:${config.agentPort}`;
            }
        }

        // $FlowIgnore - disable type inference for udpsender.
        sender = new UDPSender(hostPort);
        reporter = new RemoteReporter(sender, reporterOptions);

        if (config && config.logSpans) {
            reporter = new CompositeReporter([reporter, new LoggingReporter(options.logger)]);
        }
        return reporter;
    }

    // see ./decls/types.js for TracerConfig
    static initTracer(config: TracerConfig, options: any = {}): Tracer {
        let reporter: Reporter;
        let sampler: Sampler;
        if (config.disable) {
            return new opentracing.Tracer();
        } else {
            if (config.sampler && config.sampler.type && config.sampler.param) {
                sampler = Configuration._getSampler(config.serviceName, config.sampler);
            } else {
                sampler = new RemoteSampler(config.serviceName);
            }

            if (!options.reporter) {
                reporter = Configuration._getReporter(config.reporter, options);
            } else {
                reporter = options.reporter;
            }
        }

        console.log(`Using ${reporter.name()}`);
        console.log(`Using ${sampler.name()}`);
        return new Tracer(
            config.serviceName,
            reporter,
            sampler
        );
    }
}

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
import {Validator} from 'jsonschema';
import Logtron from 'logtron';
import opentracing from 'opentracing';

let configSchema = {
    'type': 'object',
    'required': ['jaeger'],
    'properties': {
        'jaeger': {
            'type': 'object',
            '$ref': '/jaeger'
        }
    },
};

let jaegerSchema = {
    'id': '/jaeger',
    'type': 'object',
    'required': ['serviceName'],
    'properties': {
        'serviceName': {'type': 'string'},
        'disable': {'type': 'boolean'},
        'sampler': {
            'properties': {
                'type': {'type': 'string' },
                'param': {'type': 'number' }
            },
            'required': ['type', 'param'],
            'additionalProperties': false
        },
        'reporter': {
            'properties': {
                'logSpans': {'type': 'boolean'},
                'agentHost': {'type': 'string'},
                'agentPort': {'type': 'number'},
                'flushIntervalMs': {'type': 'number'}
            },
            'additionalProperties': false
        }
    }
};

export default class Configuration {

    static _getSampler(options) {
        let type = options.sampler.type;
        let param = options.sampler.param;

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
            sampler = new RemoteSampler(options.serviceName, {
                sampler: new ProbabilisticSampler(param)
            });
        }

        return sampler;
    }

    static initTracer(options) {
        let v = new Validator();
        v.addSchema(jaegerSchema);
        v.validate(options, configSchema, {
            throwError: true
        });

        options = options.jaeger;

        let reporters = [];
        let reporter;
        let sampler;
        if (options.disable) {
            return new opentracing.Tracer();
        } else {
            let sender;
            let reporterOptions = {};
            let hostPort = '';
            if (options.reporter) {
                if (options.reporter.logSpans) {
                    let logger = Logtron({
                        meta: {
                            team: 'jaeger',
                            project: 'jaeger'
                        },
                        backends: Logtron.defaultBackends({
                            console: true
                        })
                    });
                    reporters.push(new LoggingReporter(logger));
                }

                if (options.reporter.flushIntervalMs) {
                    reporterOptions['bufferFlushInterval'] = options.reporter.flushIntervalMs;
                }

                if (options.reporter.agentHost && options.reporter.agentPort) {
                    hostPort = `${options.reporter.agentHost}:${options.reporter.agentPort}`;
                }
            }

            sender = new UDPSender(hostPort);
            reporters.push(new RemoteReporter(sender, reporterOptions));
            reporter = new CompositeReporter(reporters);

            if (options.sampler) {
                sampler = Configuration._getSampler(options);
            } else {
                sampler = new RemoteSampler(options.serviceName);
            }
        }

        console.log(`Using ${reporter.name()}`);
        console.log(`Using ${sampler.name()}`);
        return new Tracer(
            options.serviceName,
            reporter,
            sampler
        );
    }
}

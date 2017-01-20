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
import opentracing from 'opentracing';
import * as constants from './constants.js';

let jaegerSchema = {
    'id': '/jaeger',
    'type': 'object',
    'properties': {
        'serviceName': {'type': 'string'},
        'disable': {'type': 'boolean'},
        'sampler': {
            'properties': {
                'type': {'type': 'string' },
                'param': {'type': 'number' },
                'host': {'type': 'string' },
                'port': {'type': 'number' },
                'refreshIntervalMs': {'type': 'number' }
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

    static _getSampler(config) {
        let type = config.sampler.type;
        let param = config.sampler.param;
        let host = config.sampler.host;
        let port = config.sampler.port;
        let refreshIntervalMs = config.sampler.refreshIntervalMs;

        let sampler;
        if (type === constants.SAMPLER_TYPE_PROBABILISTIC) {
            sampler = new ProbabilisticSampler(param);
        }

        if (type === constants.SAMPLER_TYPE_RATE_LIMITING) {
            sampler = new RateLimitingSampler(param);
        }

        if (type === constants.SAMPLER_TYPE_CONST) {
            sampler = new ConstSampler(param === 1);
        }

        if (type === constants.SAMPLER_TYPE_REMOTE) {
            sampler = new RemoteSampler(config.serviceName, {
                sampler: new ProbabilisticSampler(param),
                host: host,
                port: port,
                refreshInterval: refreshIntervalMs
            });
        }

        return sampler;
    }

    static _getReporter(config, options) {
        let sender;
        let reporterConfig = {};
        let reporters = [];
        let hostPort = '';
        if (config.reporter) {
            if (config.reporter.logSpans) {
                reporters.push(new LoggingReporter(options.logger));
            }

            if (config.reporter.flushIntervalMs) {
                reporterConfig['bufferFlushInterval'] = config.reporter.flushIntervalMs;
            }

            if (config.reporter.agentHost && config.reporter.agentPort) {
                hostPort = `${config.reporter.agentHost}:${config.reporter.agentPort}`;
            }
        }

        sender = new UDPSender(hostPort);
        reporters.push(new RemoteReporter(sender, reporterConfig));
        return new CompositeReporter(reporters);
    }

    static initTracer(config, options = {}) {
        let v = new Validator();
        v.validate(config, jaegerSchema, {
            throwError: true
        });

        let reporters = [];
        let reporter;
        let sampler;
        if (config.disable) {
            return new opentracing.Tracer();
        } else {
            if (config.sampler) {
                sampler = Configuration._getSampler(config);
            } else {
                sampler = new RemoteSampler(config.serviceName);
            }

            if (!options.reporter) {
                reporter = Configuration._getReporter(config, options);
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

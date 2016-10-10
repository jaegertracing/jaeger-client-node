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
import NoopReporter from './reporters/noop_reporter';
import ProbabilisticSampler from './samplers/probabilistic_sampler';
import RatelimitingSampler from './samplers/ratelimiting_sampler';
import RemoteReporter from './reporters/remote_reporter';
import RemoteSampler from './samplers/remote_sampler';
import Tracer from './tracer';
import UDPSender from './reporters/udp_sender';
import {Validator} from 'jsonschema';


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

let constSamplerSchema = {
    'id': '/const',
    'type': 'object',
    'properties': {
        'type': {'type': 'string' },
        'param': {'type': 'boolean' }
    },
    'required': ['type', 'param'],
    'additionalProperties': false
};

let probabilisticSamplerSchema = {
    'id': '/probabilistic',
    'type': 'object',
    'properties': {
        'type': {'type': 'string' },
        'param': {'type': 'number' }
    },
    'required': ['type', 'param'],
    'additionalProperties': false
};

let ratelimitingSamplerSchema = {
    'id': '/ratelimiting',
    'type': 'object',
    'properties': {
        'type': {'type': 'string' },
        'param': {'type': 'number' }
    },
    'required': ['type', 'param'],
    'additionalProperties': false
};

let remoteSamplerSchema = {
    'id': '/remote',
    'type': 'object',
    'properties': {
        'type': {'type': 'string' },
        'param': {'type': 'string' },
        'managerHostPort': {'type': 'string'}
    },
    'required': ['type', 'param'],
    'additionalProperties': false
};

let jaegerSchema = {
    'id': '/jaeger',
    'type': 'object',
    'required': ['serviceName'],
    'properties': {
        'serviceName': {'type': 'string'},
        'disable': {'type': 'boolean'},
        'sampler': {
            'type': 'object',
            // should be 'oneOf', but that doesn't work properly with this implementation.
            'anyOf': [
                {'$ref': 'const'},
                {'$ref': 'probabilistic'},
                {'$ref': 'ratelimiting'},
                {'$ref': 'remote'}
            ]
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

let getSampler = (options) => {
    let type = options.sampler.type;
    let param = options.sampler.param;

    let sampler;
    if (type === 'probabilistic') {
       sampler = new ProbabilisticSampler(param);
    }

    if (type === 'ratelimiting') {
        sampler = new RatelimitingSampler(param);
    }

    if (type === 'const') {
        sampler = new ConstSampler(param);
    }

    if (type === 'remote') {
        sampler = new RemoteSampler(options.serviceName);
    }

    return sampler;
}

let initTracer = (options) => {
    let v = new Validator();
    v.addSchema(constSamplerSchema);
    v.addSchema(probabilisticSamplerSchema);
    v.addSchema(ratelimitingSamplerSchema);
    v.addSchema(remoteSamplerSchema);
    v.addSchema(jaegerSchema);
    v.validate(options, configSchema, {
        throwError: true
    });

    options = options.jaeger;

    let reporter = null;
    let sampler = null;
    if (options.disable) {
        reporter = new NoopReporter();
        sampler = new ConstSampler(false);
    } else {
        let sender;
        let reporterOptions = {};
        if (options.reporter) {
            if (options.reporter.logSpans) {
                // use logging reporter
            }
            if (options.reporter.flushIntervalMs) {
                reporterOptions['bufferFlushInterval'] = options.reporter.flushIntervalMs;
            }

            if (options.reporter.agentHost && options.reporter.agentPort) {
                let hostPort = `${options.reporter.agentHost}:${options.reporter.agentPort}`;
                sender = new UDPSender(hostPort);
            } else {
                // use default sender
                sender = new UDPSender();
            }
        } else {
            // use default sender
            sender = new UDPSender();
        }


        reporter = new RemoteReporter(sender, reporterOptions);

        if (options.sampler) {
            sampler = getSampler(options);
        } else {
            sampler = new RemoteSampler(options.serviceName);
        }
    }

    return new Tracer(
        options.serviceName,
        reporter,
        sampler
    );
}

module.exports = {
    initTracer: initTracer
};

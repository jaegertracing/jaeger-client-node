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

import ConstSampler from './samplers/const_sampler';
import ProbabilisticSampler from './samplers/probabilistic_sampler';
import RateLimitingSampler from './samplers/rate_limiting_sampler';
import RemoteReporter from './reporters/remote_reporter';
import CompositeReporter from './reporters/composite_reporter';
import LoggingReporter from './reporters/logging_reporter';
import RemoteSampler from './samplers/remote_sampler';
import Metrics from './metrics/metrics';
import Tracer from './tracer';
import UDPSender from './reporters/udp_sender';
import HTTPSender from './reporters/http_sender';
import * as opentracing from 'opentracing';
import * as constants from './constants.js';
import RemoteThrottler from './throttler/remote_throttler';
import Utils from './util.js';

let jaegerSchema = {
  id: '/jaeger',
  type: 'object',
  properties: {
    serviceName: { type: 'string' },
    disable: { type: 'boolean' },
    sampler: {
      properties: {
        type: { type: 'string' },
        param: { type: 'number' },
        hostPort: { type: 'string' },
        host: { type: 'string' },
        port: { type: 'number' },
        samplingPath: { type: 'string' },
        refreshIntervalMs: { type: 'number' },
      },
      required: ['type', 'param'],
      additionalProperties: false,
    },
    reporter: {
      properties: {
        logSpans: { type: 'boolean' },
        agentHost: { type: 'string' },
        agentPort: { type: 'number' },
        agentSocketType: { type: 'string' },
        collectorEndpoint: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
        flushIntervalMs: { type: 'number' },
        timeoutMs: { type: 'number' },
      },
      additionalProperties: false,
    },
    throttler: {
      properties: {
        host: { type: 'string' },
        port: { type: 'number' },
        refreshIntervalMs: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
};

export default class Configuration {
  static _getSampler(config, options) {
    let type = config.sampler.type;
    let param = config.sampler.param;
    let hostPort = config.sampler.hostPort;
    let host = config.sampler.host;
    let port = config.sampler.port;
    let samplingPath = config.sampler.samplingPath;
    let refreshIntervalMs = config.sampler.refreshIntervalMs;

    if (typeof param !== 'number') {
      throw new Error(`Expecting sampler.param to be a number. Received ${param}`);
    }

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
        hostPort: hostPort,
        host: host,
        port: port,
        samplingPath: samplingPath,
        refreshInterval: refreshIntervalMs,
        metrics: options.metrics,
        logger: options.logger,
      });
    }

    return sampler;
  }

  static _getReporter(config, options) {
    let reporterConfig = {};
    let reporters = [];
    let isHTTPSender = false;
    let senderConfig = {
      logger: options.logger,
    };
    if (config.reporter) {
      if (config.reporter.logSpans) {
        reporters.push(new LoggingReporter(options.logger));
      }

      if (config.reporter.flushIntervalMs) {
        reporterConfig['bufferFlushInterval'] = config.reporter.flushIntervalMs;
      }

      if (config.reporter.collectorEndpoint) {
        isHTTPSender = true;

        senderConfig['endpoint'] = config.reporter.collectorEndpoint;

        if (config.reporter.username) {
          senderConfig['username'] = config.reporter.username;
        }
        if (config.reporter.password) {
          senderConfig['password'] = config.reporter.password;
        }
        if (config.reporter.timeoutMs) {
          senderConfig['timeoutMs'] = config.reporter.timeoutMs;
        }
      }
      if (config.reporter.agentHost) {
        senderConfig['host'] = config.reporter.agentHost;
      }

      if (config.reporter.agentPort) {
        senderConfig['port'] = config.reporter.agentPort;
      }

      if (config.reporter.agentSocketType) {
        senderConfig['socketType'] = config.reporter.agentSocketType;
      }
    }
    reporterConfig['metrics'] = options.metrics;
    reporterConfig['logger'] = options.logger;
    let sender = isHTTPSender ? new HTTPSender(senderConfig) : new UDPSender(senderConfig);
    let remoteReporter = new RemoteReporter(sender, reporterConfig);
    if (reporters.length == 0) {
      return remoteReporter;
    }
    reporters.push(remoteReporter);
    return new CompositeReporter(reporters);
  }

  static _getThrottler(config, options) {
    const throttlerOptions = Utils.clone(config.throttler);
    if (options.logger) {
      throttlerOptions.logger = options.logger;
    }
    if (options.metrics) {
      throttlerOptions.metrics = options.metrics;
    }
    return new RemoteThrottler(config.serviceName, throttlerOptions);
  }

  /**
   * Initialize and return a new instance of Jaeger Tracer.
   *
   * The config dictionary is not validated for adherence to the schema above.
   * Such validation can be performed like this:
   *
   *     import {Validator} from 'jsonschema';
   *
   *     let v = new Validator();
   *     v.validate(config, jaegerSchema, {
   *       throwError: true
   *     });
   *
   * @param {Object} config - configuration matching the jaegerSchema definition.
   * @param {Object} options - options
   * @param {Object} [options.reporter] - if provided, this reporter will be used.
   *        Otherwise a new reporter will be created according to the description
   *        in the config.
   * @param {Object} [options.throttler] - if provided, this throttler will be used.
   *        Otherwise a new throttler will be created according to the description
   *        in the config.
   * @param {Object} [options.metrics] - a metrics factory (see ./_flow/metrics.js)
   * @param {Object} [options.logger] - a logger (see ./_flow/logger.js)
   * @param {Object} [options.tags] - set of key-value pairs which will be set
   *        as process-level tags on the Tracer itself.
   * @param {boolean} [options.traceId128bit] - generate root span with a 128bit traceId.
   * @param {boolean} [options.shareRpcSpan] - Share the same span for rpc span_kind.
   */

  static initTracer(config, options = {}) {
    let reporter;
    let sampler;
    let throttler;
    if (options.metrics) {
      options.metrics = new Metrics(options.metrics);
    }
    if (config.disable) {
      return new opentracing.Tracer();
    }
    if (!config.serviceName) {
      throw new Error(`config.serviceName must be provided`);
    }
    if (config.sampler) {
      sampler = Configuration._getSampler(config, options);
    } else {
      sampler = new RemoteSampler(config.serviceName, options);
    }
    if (!options.reporter) {
      reporter = Configuration._getReporter(config, options);
    } else {
      reporter = options.reporter;
    }
    if (!options.throttler) {
      if (config.throttler) {
        throttler = Configuration._getThrottler(config, options);
      }
    } else {
      throttler = options.throttler;
    }

    if (options.logger) {
      options.logger.info(`Initializing Jaeger Tracer with ${reporter} and ${sampler}`);
    }

    return new Tracer(config.serviceName, reporter, sampler, {
      contextKey: options.contextKey,
      baggagePrefix: options.baggagePrefix,
      metrics: options.metrics,
      logger: options.logger,
      tags: options.tags,
      traceId128bit: options.traceId128bit,
      shareRpcSpan: options.shareRpcSpan,
      debugThrottler: throttler,
    });
  }
}

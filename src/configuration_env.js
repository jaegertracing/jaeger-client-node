// Copyright (c) 2018 Jaeger Author.
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

import Configuration from './configuration.js';
import Utils from './util.js';

export default class ConfigurationEnv {
  static _getConfigValue(obj, key, defaultValue) {
    return (obj && obj[key]) || defaultValue;
  }

  static _getSamplerFromEnv(config) {
    let samplerConfig = {};
    let value = ConfigurationEnv._getConfigValue(config.sampler, 'type', process.env.JAEGER_SAMPLER_TYPE);
    if (value) {
      samplerConfig.type = value;
    }

    value = ConfigurationEnv._getConfigValue(config.sampler, 'param', process.env.JAEGER_SAMPLER_PARAM);
    if (value) {
      samplerConfig.param = parseFloat(value);
    }

    value = ConfigurationEnv._getConfigValue(config.sampler, 'host', process.env.JAEGER_SAMPLER_HOST);
    if (value) {
      samplerConfig.host = value;
    }

    value = ConfigurationEnv._getConfigValue(config.sampler, 'port', process.env.JAEGER_SAMPLER_PORT);
    if (value) {
      samplerConfig.port = parseInt(value);
    }

    value = ConfigurationEnv._getConfigValue(
      config.sampler,
      'refreshIntervalMs',
      process.env.JAEGER_SAMPLER_REFRESH_INTERVAL
    );
    if (value) {
      samplerConfig.refreshIntervalMs = parseInt(value);
    }

    return samplerConfig;
  }

  static _getReporterFromEnv(config) {
    let reporterConfig = {};
    let value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'logSpans',
      process.env.JAEGER_REPORTER_LOG_SPANS
    );
    if (value) {
      reporterConfig.logSpans = value;
    }

    value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'flushIntervalMs',
      process.env.JAEGER_REPORTER_FLUSH_INTERVAL
    );
    if (value) {
      reporterConfig.flushIntervalMs = parseInt(value);
    }

    value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'collectorEndpoint',
      process.env.JAEGER_REPORTER_ENDPOINT
    );
    if (value) {
      reporterConfig.collectorEndpoint = value;
    }

    value = ConfigurationEnv._getConfigValue(config.reporter, 'username', process.env.JAEGER_REPORTER_USER);
    if (value) {
      reporterConfig.username = value;
    }

    value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'password',
      process.env.JAEGER_REPORTER_PASSWORD
    );
    if (value) {
      reporterConfig.password = value;
    }

    value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'agentHost',
      process.env.JAEGER_REPORTER_AGENT_HOST
    );
    if (value) {
      reporterConfig.agentHost = value;
    }

    value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'agentPort',
      process.env.JAEGER_REPORTER_AGENT_PORT
    );
    if (value) {
      reporterConfig.agentPort = parseInt(value);
    }

    return reporterConfig;
  }

  static _parseTagsFromEnv(options) {
    if (options.tags) {
      return options.tags;
    }
    let tags = {};
    if (process.env.JAEGER_TAGS) {
      let tagsList = process.env.JAEGER_TAGS.split(',');
      let len = tagsList.length;
      let idx = 0;
      while (idx < len) {
        let kv = tagsList[idx].split('=');
        let k = kv[0].trim();
        let v = kv[1].trim();
        if (Utils.startsWith(v, '${') && Utils.endsWith(v, '}')) {
          let ed = v.substring(2, v.length - 1).split(':');
          v = process.env[ed[0]];
          if (!v && ed[1] !== '') {
            v = ed[1];
          }
        }
        tags[k] = v;
        idx += 1;
      }
    }
    return tags;
  }

  /**
   * Initialize and return a new instance of Jaeger Tracer from environment variables.
   * config or options can be passed to override environment variables.
   *
   * @param {Object} config - configuration, see Configuration.initTracer
   * @param {Object} options - options, see Configuration.initTracer
   */
  static initTracer(config = {}, options = {}) {
    config.disable = config.disable || process.env.JAEGER_DISABLE === 'true';
    config.serviceName = config.serviceName || process.env.JAEGER_SERVICE_NAME;

    options.tags = ConfigurationEnv._parseTagsFromEnv(options);
    let samplerConfig = ConfigurationEnv._getSamplerFromEnv(config);
    if (Object.keys(samplerConfig).length > 0) {
      config.sampler = samplerConfig;
    }

    if (!options.reporter) {
      let reporterConfig = ConfigurationEnv._getReporterFromEnv(config, options);
      if (Object.keys(reporterConfig).length > 0) {
        config.reporter = reporterConfig;
      }
    }
    return Configuration.initTracer(config, options);
  }
}

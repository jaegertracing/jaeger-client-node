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

const deprecatedEnvVars = {
  JAEGER_SAMPLER_HOST: 'JAEGER_SAMPLER_MANAGER_HOST_PORT',
  JAEGER_SAMPLER_PORT: 'JAEGER_SAMPLER_MANAGER_HOST_PORT',
  JAEGER_REPORTER_ENDPOINT: 'JAEGER_ENDPOINT',
  JAEGER_REPORTER_USER: 'JAEGER_USER',
  JAEGER_REPORTER_PASSWORD: 'JAEGER_PASSWORD',
  JAEGER_REPORTER_AGENT_HOST: 'JAEGER_AGENT_HOST',
  JAEGER_REPORTER_AGENT_PORT: 'JAEGER_AGENT_PORT',
  JAEGER_DISABLE: 'JAEGER_DISABLED',
};

export default class ConfigurationEnv {
  static _validateEnv() {
    Object.keys(deprecatedEnvVars).forEach(env => {
      if (process.env[env]) {
        console.warn(
          `You are using deprecated env variable ${env}. Use ${
            deprecatedEnvVars[env]
          } instead. \nDeprecated env variable will be removed in the next major release (4.x.x)`
        );
      }
    });
  }

  static _getConfigValue(obj, key, defaultValue) {
    return obj && key in obj ? obj[key] : defaultValue;
  }

  static _getSamplerFromEnv(config) {
    let samplerConfig = {};
    let value = ConfigurationEnv._getConfigValue(config.sampler, 'type', process.env.JAEGER_SAMPLER_TYPE);
    if (value) {
      samplerConfig.type = value;
    }

    value = ConfigurationEnv._getConfigValue(config.sampler, 'param', process.env.JAEGER_SAMPLER_PARAM);
    if (!isNaN(value)) {
      samplerConfig.param = parseFloat(value);
    }

    value = ConfigurationEnv._getConfigValue(
      config.sampler,
      'hostPort',
      process.env.JAEGER_SAMPLER_MANAGER_HOST_PORT
    );
    if (value) {
      samplerConfig.hostPort = value;
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
      'samplingPath',
      process.env.JAEGER_SAMPLER_SAMPLING_PATH
    );
    if (value) {
      samplerConfig.samplingPath = value;
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
      reporterConfig.logSpans = Boolean(value);
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
      process.env.JAEGER_ENDPOINT || process.env.JAEGER_REPORTER_ENDPOINT
    );
    if (value) {
      reporterConfig.collectorEndpoint = value;
    }

    value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'username',
      process.env.JAEGER_USER || process.env.JAEGER_REPORTER_USER
    );
    if (value) {
      reporterConfig.username = value;
    }

    value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'password',
      process.env.JAEGER_PASSWORD || process.env.JAEGER_REPORTER_PASSWORD
    );
    if (value) {
      reporterConfig.password = value;
    }

    value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'agentHost',
      process.env.JAEGER_AGENT_HOST || process.env.JAEGER_REPORTER_AGENT_HOST
    );
    if (value) {
      reporterConfig.agentHost = value;
    }

    value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'timeoutMs',
      process.env.JAEGER_REPORTER_TIMEOUT
    );
    if (value) {
      reporterConfig.timeoutMs = parseInt(value);
    }

    value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'agentPort',
      process.env.JAEGER_AGENT_PORT || process.env.JAEGER_REPORTER_AGENT_PORT
    );
    if (value) {
      reporterConfig.agentPort = parseInt(value);
    }

    value = ConfigurationEnv._getConfigValue(
      config.reporter,
      'agentSocketType',
      process.env.JAEGER_AGENT_SOCKET_TYPE
    );
    if (value) {
      reporterConfig.agentSocketType = value;
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
    ConfigurationEnv._validateEnv();

    config.disable =
      config.disable || process.env.JAEGER_DISABLED === 'true' || process.env.JAEGER_DISABLE === 'true';
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

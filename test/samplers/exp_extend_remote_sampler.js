// @flow
// Copyright (c) 2019 Uber Technologies, Inc.
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

import { assert } from 'chai';
import ConfigServer from '../lib/config_server';
import InMemoryReporter from '../../src/reporters/in_memory_reporter';
import LocalBackend from '../lib/metrics/local/backend.js';
import LocalMetricFactory from '../lib/metrics/local/metric_factory.js';
import Metrics from '../../src/metrics/metrics.js';
import MockLogger from '../lib/mock_logger';
import PrioritySampler from '../../src/samplers/experimental/priority_sampler';
import RemoteSampler from '../../src/samplers/remote_sampler';
import Span from '../../src/span';
import TagEqualsSampler from '../../src/samplers/experimental/tag_equals_sampler';
import Tracer from '../../src/tracer';
import Utils from '../../src/util';

describe('extended remote sampler', () => {
  class ExtendedRemoteSampler extends RemoteSampler {
    constructor(serviceName: string, options: any = {}) {
      super(serviceName, options);
    }

    _updateSampler(strategy: any): boolean {
      if (strategy.tagEqualsStrategy) {
        let tagSampler = TagEqualsSampler.fromStrategy(strategy.tagEqualsStrategy);
        if (this._sampler instanceof PrioritySampler) {
          this._sampler = this._sampler._delegates[1];
        }
        super._updateSampler(strategy.classicStrategy);
        this._sampler = new PrioritySampler([tagSampler, this._sampler]);
        return true;
      }
      return super._updateSampler(strategy.classicStrategy);
    }
  }

  let server: ConfigServer;
  let logger: MockLogger;
  let metrics: Metrics;
  let remoteSampler: ExtendedRemoteSampler;

  before(() => {
    server = new ConfigServer().start();
  });

  after(() => {
    server.close();
  });

  beforeEach(() => {
    server.clearConfigs();
    logger = new MockLogger();
    metrics = new Metrics(new LocalMetricFactory());
    remoteSampler = new ExtendedRemoteSampler('service1', {
      refreshInterval: 0,
      metrics: metrics,
      logger: logger,
    });
  });

  afterEach(() => {
    remoteSampler.close();
  });

  it('should parse extended strategy response', function(done) {
    server.addStrategy('service1', {
      tagEqualsStrategy: {
        key: 'theTag',
        values: {
          value1: {
            firehose: true,
          },
          value2: {
            firehose: false,
          },
        },
      },
      classicStrategy: {
        operationSampling: {
          defaultLowerBoundTracesPerSecond: 0,
          defaultSamplingProbability: 0,
          perOperationStrategies: [
            {
              operation: 'op1',
              probabilisticSampling: {
                samplingRate: 0,
              },
            },
          ],
        },
      },
    });
    remoteSampler._onSamplerUpdate = s => {
      assert.instanceOf(s, PrioritySampler);
      done();
    };
    remoteSampler._refreshSamplingStrategy();
  });
});

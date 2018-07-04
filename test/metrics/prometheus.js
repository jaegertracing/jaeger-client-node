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

import { assert, expect } from 'chai';
import { PrometheusMetricsFactory } from '../../src/index.js';
if(process.env.PROM_METRICS_TEST == "1") {
  var PromClient = require('prom-client');
}

describe('Prometheus metrics', () => {
  let metrics;

  before(function () {
    if(process.env.PROM_METRICS_TEST != "1") {
      this.skip();
    }
  });

  it('should initialize without namespace', () => {
    metrics = new PrometheusMetricsFactory(PromClient);
    let name = 'jaeger:gauge';

    metrics.createGauge(name).update(1);

    let singleMetric = PromClient.register.getSingleMetric(name).get();
    assert.equal(singleMetric.type, 'gauge');
    assert.equal(singleMetric.name, name);
    assert.equal(singleMetric.values[0].value, 1);
    PromClient.register.clear();
  });

  it('should throw exception when initialized without prom-client object', () => {
    expect(() => {
      let fakePromClient = {};
      metrics = new PrometheusMetricsFactory(fakePromClient);
    }).to.throw("prom-client must be provided");
  });
});

describe('Prometheus metrics with namespace', () => {
  let metrics;
  let namespace = 'test';

  before(function () {
    if(process.env.PROM_METRICS_TEST != "1") {
      this.skip();
    }
  });

  beforeEach(() => {
    try {
      metrics = new PrometheusMetricsFactory(PromClient, namespace);
    } catch (e) {
      console.log('beforeEach failed', e);
      console.log(e.stack);
    }
  });

  afterEach(() => {
    PromClient.register.clear();
  });

  it('should increment a counter with a provided value', () => {
    let name = 'jaeger:counter';

    metrics.createCounter(name).increment(1);

    name = namespace + '_' + name;
    let singleMetric = PromClient.register.getSingleMetric(name).get();
    assert.equal(singleMetric.type, 'counter');
    assert.equal(singleMetric.name, name);
    assert.equal(singleMetric.values[0].value, 1);
  });

  it('should increment a tagged counter with a provided value', () => {
    let name = 'jaeger:counter';

    let tags1 = { result: 'ok' };
    let counter1 = metrics.createCounter(name, tags1);
    counter1.increment(1);
    counter1.increment(1);

    let tags2 = { result: 'err' };
    let counter2 = metrics.createCounter(name, tags2);
    counter2.increment(); // increment by 1

    assert.equal(PromClient.register.getMetricsAsJSON().length, 1);
    name = namespace + '_' + name;
    let singleMetric = PromClient.register.getSingleMetric(name).get();
    assert.equal(singleMetric.values.length, 2);
    assert.deepEqual(singleMetric.values[0].labels, tags1);
    assert.equal(singleMetric.values[0].value, 2);
    assert.deepEqual(singleMetric.values[1].labels, tags2);
    assert.equal(singleMetric.values[1].value, 1);
  });

  it('should update counter and gauge', () => {
    metrics.createCounter('jaeger:counter', { result: 'ok' }).increment(1);
    metrics.createCounter('jaeger:counter', { result: 'err' }).increment(1);
    metrics.createGauge('jaeger:gauge', { result: 'ok' }).update(1);
    metrics.createGauge('jaeger:gauge', { result: 'err' }).update(1);
    assert.equal(PromClient.register.getMetricsAsJSON().length, 2);
  });
});

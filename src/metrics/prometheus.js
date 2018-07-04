// @flow
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

class CounterPromWrapper {
  _counter: any;

  constructor(counter: any) {
    this._counter = counter;
  }

  increment(delta: number): void {
    this._counter.inc(delta);
  }
}

class GaugePromWrapper {
  _gauge: any;

  constructor(gauge: any) {
    this._gauge = gauge;
  }

  update(value: number): void {
    this._gauge.set(value);
  }
}

export default class PrometheusMetricsFactory {
  _cache: any = {};
  _namespace: ?string;
  _promClient: any;

  /**
   * Construct metrics factory for Prometheus
   *
   * To instantiate, prom-client needs to be passed like this:
   *
   *    var PrometheusMetricsFactory = require('jaeger-client').PrometheusMetricsFactory;
   *    var promClient = require('prom-client');
   *
   *    var namespace = 'your-namespace';
   *    var metrics = new PrometheusMetricsFactory(promClient, namespace);
   *
   * @param {Object} promClient - prom-client object.
   * @param {String} namespace - Optional a namespace that prepends to each metric name.
   */
  constructor(promClient: {}, namespace: ?string) {
    if (!promClient || !promClient.Counter || !promClient.Gauge) {
      throw new Error('prom-client must be provided');
    }
    this._promClient = promClient;
    this._namespace = namespace;
  }

  _createMetric(metric: any, name: string, labels: {}): any {
    let labelNames = [];
    let labelValues = [];
    for (let key in labels) {
      labelNames.push(key);
      labelValues.push(labels[key]);
    }
    let key = name + ',' + labelNames.toString();
    let help = name;
    if (this._namespace) {
      name = this._namespace + '_' + name;
    }
    if (!(key in this._cache)) {
      this._cache[key] = new metric(name, help, labelNames);
    }
    return labelValues.length > 0 ? this._cache[key].labels(...labelValues) : this._cache[key];
  }

  /**
   * Create a counter metric
   * @param {string} name - metric name
   * @param {any} tags - labels
   * @returns {Counter} - created counter metric
   */
  createCounter(name: string, tags: {}): Counter {
    return new CounterPromWrapper(this._createMetric(this._promClient.Counter, name, tags));
  }

  /**
   * Create a gauge metric
   * @param {string} name - metric name
   * @param {any} tags - labels
   * @returns {Gauge} - created gauge metric
   */
  createGauge(name: string, tags: {}): Gauge {
    return new GaugePromWrapper(this._createMetric(this._promClient.Gauge, name, tags));
  }
}

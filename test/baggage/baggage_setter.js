// Copyright (c) 2017 Uber Technologies, Inc.
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

import {assert} from 'chai';
import Metrics from '../../src/metrics/metrics.js';
import LocalMetricFactory from '../lib/metrics/local/metric_factory.js';
import LocalBackend from '../lib/metrics/local/backend.js';
import BaggageSetter from "../../src/baggage/baggage_setter.js";
import Tracer from '../../src/tracer.js';
import InMemoryReporter from '../../src/reporters/in_memory_reporter.js';
import ConstSampler from '../../src/samplers/const_sampler.js';
import DefaultBaggageRestrictionManager from "../../src/baggage/default_baggage_restriction_manager.js";
import Restriction from "../../src/baggage/restriction";
import sinon from 'sinon';

describe('BaggageSetter should', () => {
    let metrics: Metrics;
    let reporter = new InMemoryReporter();
    let tracer, span;

    let assertBaggageLogs = function(log, key, value, truncated, override, invalid) {
        let fields: { [key: string]: string } = {};
        log.fields.forEach((kv) => {
           fields[kv.key] = kv.value;
        });
        assert.equal(fields.event, 'baggage');
        assert.equal(fields.key, key);
        assert.equal(fields.value, value);
        if (truncated) {
            assert.equal(fields.truncated, 'true');
        }
        if (override) {
            assert.equal(fields.override, 'true');
        }
        if (invalid) {
            assert.equal(fields.invalid, 'true');
        }
    };

    beforeEach(() => {
        metrics = new Metrics(new LocalMetricFactory());

        tracer = new Tracer(
            'test-service-name',
            reporter,
            new ConstSampler(true),
            {
                metrics: metrics,
            }
        );

        span = tracer.startSpan('op-name');
    });

    afterEach(() => {
        tracer.close();
    });

    it ('fail for invalid baggage key', () => {
        let mgr = new DefaultBaggageRestrictionManager();
        sinon.stub(mgr, 'getRestriction', function(key) {
            return new Restriction(false, 0);
        });
        let setter = new BaggageSetter(mgr, metrics);
        let key = "key";
        let value = "value";
        let spanContext = setter.setBaggage(span, key, value);
        assert.isUndefined(spanContext._baggage[key]);
        assertBaggageLogs(span._logs[0], key, value, false, false, true);
        assert.equal(LocalBackend.counterValue(metrics.baggageUpdateFailure), 1);
    });

    it ('truncate valid baggage key using maxValueLength', () => {
        let setter = new BaggageSetter(new DefaultBaggageRestrictionManager(5), metrics);
        let key = "key";
        let value = "0123456789";
        let expected = "01234";
        // Set pre existing baggage to context
        span._spanContext = span.context().withBaggageItem(key, value);

        let spanContext = setter.setBaggage(span, key, value);
        assert.equal(spanContext._baggage[key], expected);
        assertBaggageLogs(span._logs[0], key, expected, true, true, false);
        assert.equal(LocalBackend.counterValue(metrics.baggageUpdateSuccess), 1);
        assert.equal(LocalBackend.counterValue(metrics.baggageTruncate), 1);
    });

    it ('not set logs if span is not sampled', () => {
        let mgr = new DefaultBaggageRestrictionManager();
        tracer = new Tracer(
            'test-service-name',
            reporter,
            new ConstSampler(false),
            {
                metrics: metrics,
                baggageRestrictionManager: mgr,
            }
        );
        span = tracer.startSpan('op-name');

        let setter = new BaggageSetter(mgr, metrics);
        let key = "key";
        let value = "0123456789";
        let spanContext = setter.setBaggage(span, key, value);
        assert.equal(spanContext._baggage[key], value);
        assert.lengthOf(span._logs, 0);
    });
});

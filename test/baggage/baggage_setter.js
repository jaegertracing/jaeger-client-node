// Copyright (c) 2017 Uber Technologies, Inc.
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
        assert.equal(fields['event'], 'baggage');
        assert.equal(fields['key'], key);
        assert.equal(fields['value'], value);
        if (truncated) {
            assert.equal(fields['truncated'], 'true');
        }
        if (override) {
            assert.equal(fields['override'], 'true');
        }
        if (invalid) {
            assert.equal(fields['invalid'], 'true');
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

    it ('fail for invalid baggage key', (done) => {
        let mgr = new DefaultBaggageRestrictionManager();
        let stub = sinon.stub(mgr, 'getRestriction', function(key) {
            return new Restriction(false, 0);
        });
        let setter = new BaggageSetter(mgr, metrics);
        let key = "key";
        let value = "value";
        let ctx = setter.setBaggage(span, key, value);
        assert.isUndefined(ctx._baggage[key]);
        assertBaggageLogs(span._logs[0], key, value, false, false, true);
        assert.equal(LocalBackend.counterValue(metrics.baggageUpdateFailure), 1);
        done();
    });

    it ('succeed for valid baggage key', (done) => {
        let setter = new BaggageSetter(new DefaultBaggageRestrictionManager(5), metrics);
        let key = "key";
        let value = "0123456789";
        let expected = "01234";
        // Set pre existing baggage to context
        span._spanContext = span.context().withBaggageItem(key, value);

        let ctx = setter.setBaggage(span, key, value);
        assert.equal(ctx._baggage[key], expected);
        assertBaggageLogs(span._logs[0], key, expected, true, true, false);
        assert.equal(LocalBackend.counterValue(metrics.baggageUpdateSuccess), 1);
        assert.equal(LocalBackend.counterValue(metrics.baggageTruncate), 1);
        done();
    });

    it ('not set logs if span is not sampled', (done) => {
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
        let ctx = setter.setBaggage(span, key, value);
        assert.equal(ctx._baggage[key], value);
        assert.lengthOf(span._logs, 0);
        done();
    });
});

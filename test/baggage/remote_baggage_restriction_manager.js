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
import sinon from 'sinon';
import Metrics from '../../src/metrics/metrics.js';
import MockLogger from '../lib/mock_logger';
import ConfigServer from '../lib/config_server';
import LocalMetricFactory from '../lib/metrics/local/metric_factory.js';
import LocalBackend from '../lib/metrics/local/backend.js';
import RemoteBaggageRestrictionManager from '../../src/baggage/remote_baggage_restriction_manager';

describe('RemoteBaggageRestrictionManager', () => {
    let server: ConfigServer;
    let logger: MockLogger;
    let metrics: Metrics;
    let restrictionManager: RemoteBaggageRestrictionManager;

    before(() => {
        server = new ConfigServer().start();
    });

    after(() => {
        server.close();
    });

    beforeEach((done) => {
        server.clearConfigs();
        logger = new MockLogger();
        metrics = new Metrics(new LocalMetricFactory());

        // The constructor attempts to retrieve restrictions on startup, need to wait for
        // it to fail before starting the tests.
        let tempIncrement = metrics.baggageRestrictionsUpdateFailure.increment;
        metrics.baggageRestrictionsUpdateFailure.increment = function() {
            metrics.baggageRestrictionsUpdateFailure.increment = tempIncrement;
            logger.clear();
            done();
        };

        restrictionManager = new RemoteBaggageRestrictionManager('service1', {
            refreshInterval: 0,
            metrics: metrics,
            logger: logger,
        });
    });

    afterEach(() => {
        restrictionManager.close();
    });

    it ('should log metric on failing to query for baggage restrictions', (done) => {
        metrics.baggageRestrictionsUpdateFailure.increment = function() {
            assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
            done();
        };
        restrictionManager._host = 'fake-host';
        restrictionManager._refreshBaggageRestrictions();
    });

    it (`should log metric on failing to parse bad http response`, (done) => {
        metrics.baggageRestrictionsUpdateFailure.increment = function() {
            assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
            done();
        };
        server.addRestrictions('service1', 'not-json-in-the-slightest');
        restrictionManager._refreshBaggageRestrictions();
    });

    it('should log metric on bad restrictions', (done) => {
        metrics.baggageRestrictionsUpdateFailure.increment = function() {
            assert.equal(logger._errorMsgs.length, 1, `errors=${logger._errorMsgs}`);
            done();
        };
        restrictionManager._serviceName = 'bad-service';
        restrictionManager._refreshBaggageRestrictions();
    });

    it('should retrieve baggage restrictions', (done) => {
        server.addRestrictions('service1', [{
            baggageKey: 'key',
            maxValueLength: 10
        }]);

        restrictionManager._onRestrictionsUpdate = (mgr) => {
            let [valid, size] = mgr.isValidBaggageKey('key');
            assert.isTrue(valid);
            assert.equal(10, size);

            [valid, size] = mgr.isValidBaggageKey('invalid-key');
            assert.isFalse(valid);
            done();
        };

        restrictionManager._refreshBaggageRestrictions();
    });

    it('should allow all baggage keys for failOpen', (done) => {
        let [valid, size] = restrictionManager.isValidBaggageKey("luggage");
        assert.isTrue(valid);
        assert.equal(2048, size);
        done();
    });

    it('should allow no baggage keys for failClosed', (done) => {
        restrictionManager._failClosed = true;
        let [valid, size] = restrictionManager.isValidBaggageKey("luggage");
        assert.isFalse(valid);
        done();
    });

    it('should refresh periodically', (done) => {
        server.addRestrictions('service1', [{
            baggageKey: 'key',
            maxValueLength: 10
        }]);
        let clock: any = sinon.useFakeTimers();

        let mgr = new RemoteBaggageRestrictionManager('service1', {
            refreshInterval: 10,
            metrics: metrics,
            logger: logger,
            onRestrictionsUpdate: (m) => {
                assert.notEqual(LocalBackend.counterValue(metrics.baggageRestrictionsUpdateSuccess), 0);
                assert.equal(logger._errorMsgs.length, 0, 'number of error logs');
                let [valid, size] = mgr.isValidBaggageKey('key');
                assert.isTrue(valid);
                assert.equal(10, size);

                clock.restore();

                mgr._onRestrictionsUpdate = null;
                mgr.close(done);
            }
        });
        clock.tick(20);
    });
});

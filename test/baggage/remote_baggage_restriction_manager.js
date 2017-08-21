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
import MockLogger from '../lib/mock_logger';
import ConfigServer from '../lib/config_server';
import LocalMetricFactory from '../lib/metrics/local/metric_factory.js';
import LocalBackend from '../lib/metrics/local/backend.js';
import RemoteBaggageRestrictionManager from '../../src/baggage/remote_baggage_restriction_manager';
import Restriction from "../../src/baggage/restriction";

describe('RemoteBaggageRestrictionManager', () => {
    let server: ConfigServer;
    let logger: MockLogger;
    let metrics: Metrics;
    let restrictionManager: RemoteBaggageRestrictionManager;
    let serviceName = 'service1';

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

        restrictionManager = new RemoteBaggageRestrictionManager(serviceName, {
            refreshIntervalMs: 0,
            initialDelayMs: 60000,
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
        server.addRestrictions(serviceName, 'not-json-in-the-slightest');
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
        let key = 'key';
        server.addRestrictions(serviceName, [{
            baggageKey: key,
            maxValueLength: 10
        }]);

        restrictionManager._onRestrictionsUpdate = (mgr) => {
            let restriction = mgr.getRestriction(serviceName, key);
            assert.deepEqual(restriction, new Restriction(true, 10));

            restriction = mgr.getRestriction(serviceName, 'invalid-key');
            assert.deepEqual(restriction, new Restriction(false, 0));
            done();
        };

        restrictionManager._refreshBaggageRestrictions();
    });

    it('should allow all baggage keys for allowBaggageOnInitializationFailure', () => {
        let restriction = restrictionManager.getRestriction(serviceName, 'luggage');
        assert.deepEqual(restriction, new Restriction(true, 2048));
    });

    it('should allow no baggage keys for denyBaggageOnInitializationFailure', () => {
        restrictionManager._denyBaggageOnInitializationFailure = true;
        let restriction = restrictionManager.getRestriction(serviceName, 'luggage');
        assert.deepEqual(restriction, new Restriction(false, 0));
    });

    it('should refresh periodically', (done) => {
        let key = 'key';
        server.addRestrictions(serviceName, [{
            baggageKey: key,
            maxValueLength: 10
        }]);

        let mgr = new RemoteBaggageRestrictionManager(serviceName, {
            metrics: metrics,
            logger: logger,
            refreshIntervalMs: 0,
            initialDelayMs: 0,
            onRestrictionsUpdate: (m) => {
                assert.notEqual(LocalBackend.counterValue(metrics.baggageRestrictionsUpdateSuccess), 0);
                assert.equal(logger._errorMsgs.length, 0, 'number of error logs');
                let restriction = m.getRestriction(serviceName, key);
                assert.deepEqual(restriction, new Restriction(true, 10));

                done();
            }
        });
    });
});

'use strict';

var _chai = require('chai');

var _http_server = require('../src/http_server.js');

var _http_server2 = _interopRequireDefault(_http_server);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

process.env.NODE_ENV = 'test'; // Copyright (c) 2016 Uber Technologies, Inc.
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

describe('crossdock http server should', function () {
    var server = void 0;
    before(function () {
        server = new _http_server2.default();
    });

    it('return proper trace response for start_request, and join_trace combined', function (done) {
        var sampled = true;
        var baggage = "7e859ffef96e5da6";
        var host = "127.0.0.1";
        var startRequest = {
            "serverRole": "S1",
            "sampled": sampled,
            "baggage": baggage,
            "downstream": {
                "serviceName": "node",
                "serverRole": "S2",
                "host": host,
                "port": "8081",
                "transport": "HTTP",
                "downstream": {
                    "serviceName": "node",
                    "serverRole": "S3",
                    "host": host,
                    "port": "8081",
                    "transport": "HTTP"
                }
            }
        };

        setTimeout(function () {
            var headers = { 'Content-Type': 'application/json' };
            _request2.default.post({
                'url': 'http://127.0.0.1:8081/start_trace',
                'forever': true,
                'headers': headers,
                'body': JSON.stringify(startRequest)
            }, function (err, response) {
                if (err) {
                    console.log('err', err);
                }

                // top level span
                _chai.assert.isNotOk(err);
                var traceResponse = JSON.parse(response.body);
                _chai.assert.isOk(traceResponse.span.traceId);
                _chai.assert.equal(traceResponse.span.sampled, true);
                _chai.assert.equal(traceResponse.span.baggage, '7e859ffef96e5da6');

                // downstream level 1
                _chai.assert.isOk(traceResponse.downstream);
                _chai.assert.equal(traceResponse.notImplementedError, '');
                _chai.assert.equal(traceResponse.span.traceId, traceResponse.downstream.span.traceId);
                _chai.assert.equal(traceResponse.downstream.span.sampled, true);
                _chai.assert.equal(traceResponse.downstream.span.baggage, '7e859ffef96e5da6');
                _chai.assert.equal(traceResponse.downstream.notImplementedError, '');

                // downstream level 2
                _chai.assert.isOk(traceResponse.downstream.downstream);
                _chai.assert.equal(traceResponse.downstream.span.traceId, traceResponse.downstream.downstream.span.traceId);
                _chai.assert.equal(traceResponse.downstream.downstream.notImplementedError, '');
                _chai.assert.isOk(traceResponse.downstream.downstream.span.sampled, true);
                _chai.assert.isOk(traceResponse.downstream.downstream.span.baggage, '7e859ffef96e5da6');
                done();
            });
        }, 3000);
    }).timeout(5000);

    it('return proper trace response for start_request', function (done) {
        var sampled = true;
        var baggage = "7e859ffef96e5da6";
        var host = "127.0.0.1";
        var startRequest = {
            "serverRole": "S1",
            "sampled": sampled,
            "baggage": baggage
        };

        var headers = { 'Content-Type': 'application/json' };
        _request2.default.post({
            'url': 'http://127.0.0.1:8081/start_trace',
            'forever': true,
            'headers': headers,
            'body': JSON.stringify(startRequest)
        }, function (err, response) {
            if (err) {
                console.log('err', err);
            }
            _chai.assert.isNotOk(err);
            var traceResponse = JSON.parse(response.body);
            _chai.assert.equal(traceResponse.span.sampled, true);
            _chai.assert.equal(traceResponse.span.baggage, '7e859ffef96e5da6');
            _chai.assert.equal(traceResponse.notImplementedError, '');
            done();
        });
    });

    it('return proper trace response for join_request', function (done) {
        var sampled = true;
        var baggage = "7e859ffef96e5da6";
        var host = "127.0.0.1";
        var joinRequest = {
            "serverRole": "S1"
        };

        var headers = { 'Content-Type': 'application/json' };
        _request2.default.post({
            'url': 'http://127.0.0.1:8081/join_trace',
            'forever': true,
            'headers': headers,
            'body': JSON.stringify(joinRequest)
        }, function (err, response) {
            if (err) {
                console.log('err', err);
            }

            _chai.assert.isNotOk(err);
            var traceResponse = JSON.parse(response.body);
            _chai.assert.equal(traceResponse.span.sampled, false);
            _chai.assert.equal(traceResponse.notImplementedError, '');
            done();
        });
    });
});
//# sourceMappingURL=http_server.js.map
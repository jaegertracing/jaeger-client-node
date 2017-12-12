'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
// Copyright (c) 2016 Uber Technologies, Inc.
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

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SamplingServer = function () {
    function SamplingServer() {
        var port = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 5778;

        _classCallCheck(this, SamplingServer);

        this._port = port;
        this._app = (0, _express2.default)();
        this._strategies = Object.create(null);
        this._app.get('/sampling', this._handle.bind(this));
    }

    _createClass(SamplingServer, [{
        key: 'addStrategy',
        value: function addStrategy(serviceName, response) {
            this._strategies[serviceName] = response;
        }
    }, {
        key: 'clearStrategies',
        value: function clearStrategies() {
            this._strategies = Object.create(null);
        }
    }, {
        key: '_handle',
        value: function _handle(req, res) {
            var service = req.query.service;
            var strategy = this._strategies[service];
            if (strategy) {
                res.send(strategy);
            } else {
                res.status(404).send({ err: 'unknown service name \'' + service + '\'' });
            }
        }
    }, {
        key: 'start',
        value: function start() {
            this._server = this._app.listen(this._port);
            return this;
        }
    }, {
        key: 'close',
        value: function close() {
            this._server.close();
        }
    }]);

    return SamplingServer;
}();

exports.default = SamplingServer;
//# sourceMappingURL=sampler_server.js.map
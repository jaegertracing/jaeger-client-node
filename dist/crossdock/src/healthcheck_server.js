'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _helpers = require('./helpers');

var _helpers2 = _interopRequireDefault(_helpers);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
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

var HealthcheckServer = function HealthcheckServer() {
    _classCallCheck(this, HealthcheckServer);

    var app = (0, _express2.default)();
    app.use(_bodyParser2.default.json());
    app.head('/', function (req, res) {
        res.sendStatus(200);
    });

    app.listen(8080, function () {
        _helpers2.default.log('Healthcheck server on port 8080...');
    });
};

exports.default = HealthcheckServer;


if (require.main === module) {
    var healthcheck = new HealthcheckServer();
}
//# sourceMappingURL=healthcheck_server.js.map
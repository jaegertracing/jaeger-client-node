// @flow
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

import express from 'express';
import bodyParser from 'body-parser';
import Helpers from './helpers';

export default class HealthcheckServer {
    constructor() {
        let app: any = express();
        app.use(bodyParser.json());
        app.head('/', (req, res) => {
            res.sendStatus(200);
        });

        app.listen(8080, () => {
            Helpers.log('Healthcheck server on port 8080...');
        });
    }
}

if ((require: any).main === module) {
    let healthcheck = new HealthcheckServer();
}

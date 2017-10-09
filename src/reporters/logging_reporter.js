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

import Span from '../span.js';
import NullLogger from '../logger.js';

export default class LoggingReporter {
    _logger: Logger;

    constructor(logger: Logger) {
        this._logger = logger || new NullLogger();
    }

    report(span: Span): void {
        this._logger.info(`Reporting span ${span.context().toString()}`);
    }

    name(): string {
        return 'LoggingReporter';
    }

    close(callback: ?Function): void {
        if (callback) {
            callback();
        }
    }
}

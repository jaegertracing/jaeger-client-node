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
import ThriftUtils from '../thrift.js';

export default class InMemoryReporter {
    _spans: Array<Span>;
    _process: Process;

    constructor() {
        this._spans = [];
    }

    name(): string {
        return 'InMemoryReporter';
    }

    report(span: Span): void {
        this._spans.push(span);
    }

    get spans(): Array<Span> {
        return this._spans;
    }

    clear(): void {
        this._spans = [];
    }

    close(callback: ?Function): void {
        if (callback) {
            callback();
        }
    }

    setProcess(serviceName: string, tags: Array<Tag>): void {
        this._process = {
            'serviceName': serviceName,
            'tags': ThriftUtils.getThriftTags(tags)
        };
    }
}

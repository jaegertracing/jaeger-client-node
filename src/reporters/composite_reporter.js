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

export default class CompositeReporter {
  _reporters: Array<Reporter>;

  constructor(reporters: Array<Reporter>) {
    this._reporters = reporters;
  }

  name(): string {
    return 'CompositeReporter';
  }

  report(span: Span): void {
    this._reporters.forEach(r => {
      r.report(span);
    });
  }

  _compositeCallback(limit: number, callback: () => void): () => void {
    let count = 0;
    return () => {
      count++;
      if (count >= limit) {
        callback();
      }
    };
  }

  close(callback?: () => void): void {
    const modifiedCallback = callback
      ? this._compositeCallback(this._reporters.length, callback)
      : function() {};
    this._reporters.forEach(r => {
      r.close(modifiedCallback);
    });
  }

  setProcess(serviceName: string, tags: Array<Tag>): void {
    this._reporters.forEach(r => {
      if (r.setProcess) {
        r.setProcess(serviceName, tags);
      }
    });
  }
}

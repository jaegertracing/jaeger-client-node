// @flow
// Copyright (c) 2018 Uber Technologies, Inc.
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

import { Thrift } from 'thriftrw';

export default class SenderUtils {
  static invokeCallback(callback?: SenderCallback, numSpans: number, error?: string) {
    if (callback) {
      callback(numSpans, error);
    }
  }

  static convertProcessToThrift(t: Thrift, process: Process) {
    const tagMessages = [];
    for (let j = 0; j < process.tags.length; j++) {
      const tag = process.tags[j];
      tagMessages.push(new t.Tag(tag));
    }

    return new t.Process({
      serviceName: process.serviceName,
      tags: tagMessages,
    });
  }
}

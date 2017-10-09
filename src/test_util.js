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

import opentracing from 'opentracing';
import Span from './span';
import Utils from './util';

export default class TestUtils {
    static hasTags(span: Span, expectedTags: any): boolean {
        // TODO(oibe) make this work for duplicate tags
        let actualTags = {};
        for (let i = 0; i < span._tags.length; i++) {
            let key = span._tags[i].key;
            actualTags[key] = span._tags[i].value;
        }

        for (let tag in expectedTags) {
            if (expectedTags.hasOwnProperty(tag) && actualTags.hasOwnProperty(tag)) {
                if (actualTags[tag] !== expectedTags[tag]) {
                    console.log('expected tag:', expectedTags[tag], ', actual tag: ', actualTags[tag]);
                    return false;
                }
            } else {
                // mismatch in tag keys
                return false;
            }
        }

        return true;
    }

    /**
     * Returns tags stored in the span. If tags with the same key are present,
     * only the last tag is returned.
     * @param {Object} span - span from which to read the tags.
     * @param {Array} [keys] - if specified, only tags with these keys are returned.
     */
    static getTags(span: Span, keys: ?Array<string>): any {
        let actualTags = {};
        for (let i = 0; i < span._tags.length; i++) {
            let key = span._tags[i].key;
            actualTags[key] = span._tags[i].value;
        }
        if (keys) {
            let filteredTags = {};
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                if (actualTags.hasOwnProperty(key)) {
                    filteredTags[key] = actualTags[key];
                }
            }
            return filteredTags;
        }
        return actualTags;
    }
}

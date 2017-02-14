// @flow
// Copyright (c) 2016 Uber Technologies, Inc.
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

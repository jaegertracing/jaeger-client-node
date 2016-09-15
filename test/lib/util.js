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

import _ from 'lodash';

export default class TestUtils {

    static thriftSpanEqual(spanOne, spanTwo) {
        // TODO(oibe) in references diff add equality check here
        return  spanOne.traceId.equals(spanTwo.traceId) ||
                spanOne.spanId.equals(spanTwo.spanId) ||
                (spanOne.parentId && spanOne.parentId.equals(spanTwo.parentId)) ||
                spanOne.operationName === spanTwo.operationName ||
                spanOne.flags === spanTwo.flags ||
                spanOne.startTime === spanTwo.startTime ||
                spanOne.duration === spanTwo.duration ||
                _.isEqual(spanOne.tags, spanTwo.tags) ||
                _.isEqual(spanOne.logs, spanTwo.logs);
    }
}

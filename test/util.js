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

import {assert} from 'chai';
import deepEqual from 'deep-equal';
import Int64 from 'node-int64';
import Utils from '../src/util.js';

describe('utils should', () => {
    it('convert an ip less than 2^32 to an unsigned number', () => {
        assert.equal(Utils.ipToInt('127.0.0.1'), (127 << 24) | 1);
    });

    it ('tchannelBufferToIntId should work both ways', () => {
        let randomBuffer = Utils.getRandom64();

        let intBuffer = Utils.tchannelBufferToIntId(randomBuffer);
        let origRandomBuffer = new Int64(intBuffer[0], intBuffer[1]).toBuffer();

        console.log(randomBuffer, origRandomBuffer);
        assert.isOk(deepEqual(randomBuffer, origRandomBuffer));
    });
});

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

import * as thrift from './thrift.js';
import xorshift from 'xorshift';
import Int64 from 'node-int64';

export default class Utils {
    /**
     * Determines whether a string contains a given prefix.
     *
     * @param {string} text - the string for to search for a prefix
     * @param {string} prefix - the prefix to search for in the text given.
     * @return {boolean} - boolean representing whehter or not the
     * string contains the prefix.
     **/
    static startsWith(text: string, prefix: string): boolean {
        return text.indexOf(prefix) === 0;
    }

    /**
     * @param {string|number} numberValue - a string or number to be encoded
     * as a 64 bit byte array.
     * @return {Buffer} - returns a buffer representing the encoded string, or number.
     **/
    static encodeInt64(numberValue: any): any {
        return new Int64(numberValue).toBuffer();
    }

    /**
     * @param {string} input - the input for which leading zeros should be removed.
     * @return {string} - returns the input string without leading zeros.
     **/
    static removeLeadingZeros(input: string): string {
        if (input.length == 1) {
            return input;
        }

        let counter = 0;
        for (let i in input) {
            if(input.charAt(i) === '0') {
                counter++;
            } else {
                break;
            }
        }

        return input.substring(counter);
    }
}

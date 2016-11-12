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

import xorshift from 'xorshift';
import Int64 from 'node-int64';
import os from 'os';

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
     * Determines whether a string contains a given prefix.
     *
     * @return {Buffer}  - returns a buffer representing a random 64 bit
     * number.
     **/
    static getRandom64(): Buffer {
        let randint = xorshift.randomint();
        let buf = new Buffer(8);
        buf.writeUInt32BE(randint[0], 0);
        buf.writeUInt32BE(randint[1], 4);
        return buf;
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
     * @param {string} ip - a string representation of an ip address.
     * @return {number} - a 32-bit number where each byte represents an
     * octect of an ip address.
     **/
    static ipToInt(ip: string): ?number {
        let ipl = 0;
        let parts = ip.split('.');
        if (parts.length != 4) {
            return null;
        }

        for (let i = 0; i < parts.length; i++) {
            ipl <<= 8;
            ipl += parseInt(parts[i], 10);
        }

        let signedLimit = 0x7fffffff;
        if (ipl > signedLimit) {
            return (1 << 32) - ipl;
        }
        return ipl;
    }

    /**
     * @param {string} input - the input for which leading zeros should be removed.
     * @return {string} - returns the input string without leading zeros.
     **/
    static removeLeadingZeros(input: string): string {
        let counter = 0;
        let length = input.length - 1;
        for (let i = 0; i < length; i++) {
            if(input.charAt(i) === '0') {
                counter++;
            } else {
                break;
            }
        }

        return input.substring(counter);
    }

    /**
     * Returns the timestamp in microseconds.
     * @return {number} - The microseconds since the epoch.
     **/
    static getTimestampMicros(): number {
        // TODO(oibe) investigate process.hrtime.  I'm not sure if its in all node versions.
        // http://stackoverflow.com/questions/11725691/how-to-get-a-microtime-in-node-js
        return Date.now() * 1000;
    }

    static myIp(): string {
        let myIp = '0.0.0.0';
        let ifaces = os.networkInterfaces();
        let keys = Object.keys(ifaces);
        loop1:
        for (let i = 0; i < keys.length; i++) {
            let iface = ifaces[keys[i]];
            for (let j = 0; j < iface.length; j++) {
                if (iface[j].family === 'IPv4' && !iface[j].internal) {
                    myIp = iface[j].address;
                    break loop1;
                }
            }
        }
        return myIp;
    }

    static clone(obj: any): any {
        let newObj = {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                newObj[key] = obj[key];
            }
        }

        return newObj;
    }

    static convertObjectToTags(dict: any): Array<Tag> {
        let tags: Array<Tag> = [];
        for (let key in dict) {
            let value = dict[key];
            if (dict.hasOwnProperty(key)) {
                tags.push({ 'key': key, 'value': value });
            }
        }

        return tags;
    }

    static shallowClone(obj) {
        let newObj = {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                newObj[key] = obj[key];
            }
        }
        return newObj;
    }

    /**
     * Example:
     * combinations(['encoding', 'mode'], {encoding: ['json', 'thrift'], mode: ['channel', 'request']})
     * Produced combinations:
     *
     * [{ encoding: 'json', mode: 'channel' },
     *  { encoding: 'json', mode: 'request' },
     *  { encoding: 'thrift', mode: 'channel' },
     *  { encoding: 'thrift', mode: 'request' }]
     * */
    static combinations(paramLists, keysParam, combination = {}, results = []) {
        let keys = keysParam || Object.keys(paramLists);
        if (keys.length === 0) {
            let descriptionArray = [];
            let keys = Object.keys(paramLists);
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                descriptionArray.push(`${key}=${combination[key]}`);
            }
            combination.description = descriptionArray.join(',');
            results.push(Utils.shallowClone(combination));
            return results;
        }

        let key = keys[0];
        let paramList = paramLists[key];
        for (let j = 0; j < paramList.length; j++) {
            let param = paramList[j];

            combination[key] = param;
            results = Utils.combinations(paramLists, keys.slice(1),  combination, results);
        }

        return results;
    }
}

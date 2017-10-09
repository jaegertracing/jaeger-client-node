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
}

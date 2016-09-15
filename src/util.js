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

import Long from 'long';
import os from 'os';
import xorshift from 'xorshift';

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
     * @return {object}  - returns a Long representing a random 64 bit
     * number.
     **/
    static getRandom64(): Long {
        let randint: Array<number> = xorshift.randomint();
        let unsigned: boolean = true;
        return new Long(randint[0], randint[1], unsigned);
    }

    static encodeInt64(lower, higher): Long {
        let unsigned: boolean =  true;
        return new Long(lower, higher, unsigned);
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
            return (1 << 31) - ipl;
        }
        return ipl;
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
        for (let i = 0; i < input.length; i++) {
            if(input.charAt(i) === '0') {
                counter++;
            } else {
                break;
            }
        }

        return input.substring(counter);
    }

    /**
     * @param {string} serviceName - the service name of the endpoint
     * @param {string} ipv4 - the ip address of the endpoint
     * @param {number} port - the port of the endpoint
     * @return {Endpoint} - an endpoint object representing the 3 parameters
     * received.
     **/
    static createEndpoint(serviceName: string , ipv4: any, port: number): Endpoint {
        if (ipv4 === 'localhost') {
            ipv4 = '127.0.0.1';
        }

        return {
            ipv4: Utils.ipToInt(ipv4) || 0,
            port: port || 0,
            serviceName: serviceName
        };
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

    static myIp(): ?string {
        let ifaces = os.networkInterfaces();
        let keys = Object.keys(ifaces);
        for (let i = 0; i < keys.length; i++) {
            let iface = ifaces[keys[i]];
            for (let j = 0; j < iface.length; j++) {
                if (iface[j].family === 'IPv4' && !iface[j].internal) {
                    return iface[j].address;
                }
            }
        }
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

    static isParsableHex64(inputStr: string): any {
        let hexLookup = {'0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8',
            '9': '9', 'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'e', 'f': 'f'};
        let unsigned = true;

        for (let i = 0 ; i < inputStr.length; i++) {
            if(!(inputStr[i] in hexLookup)) {
                return Number.NaN;
            }
        }

        return Long.fromString(inputStr, unsigned, 16);
    }
}

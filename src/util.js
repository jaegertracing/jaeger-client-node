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
    static ipToInt(ip: string): number {
        let ipl = 0;
        let parts = ip.split('.');
        for (let i = 0; i < parts.length; i++) {
            ipl <<= 8;
            ipl += parseInt(parts[i], 10);
        }
        // TODO(oibe) prove that this will never be grater than 2^31 because
        // zipkin core thrift complains
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
            ipv4: Utils.ipToInt(ipv4),
            port: port || 0,
            serviceName: serviceName
        };
    }

    /**
     * @param {string} key - the key of the binary annotation
     * @param {string} value - the value of the binary annotation
     * @param {string} annotationType - the annotationType from thrift to be used
     * @param {Endpoint} host - the endpoint to attach to this annotation.
     * @return {BinaryAnnotation} - a binary annotation representing the parameters received.
     **/
    static createBinaryAnnotation(
            key: string,
            value: any,
            annotationType: string,
            host?: Endpoint): BinaryAnnotation {

        return {
            key: key,
            value: new Buffer(value, 'binary'),
            annotationType: annotationType,
            host: host
        };
    }

    /**
     * @param {string} key - the key of the binary annotation
     * @param {number} value - the value of the binary annotation
     * @return {BinaryAnnotation} - a binary annotation representing the parameters received.
     **/
    static createIntegerTag(key: string, value: number): BinaryAnnotation {
        let max_16 = 0x7fff;
        let min_16 = -0x7fff - 1;
        let max_32 = 0x7fffffff;
        let min_32 = -0x7fffffff - 1;

        let type;
        let buf;
        if (value < min_32 || value > max_32) {
            type = thrift.annotationType.I64;
            buf = Utils.encodeInt64(value, 0);
        } else if (value < min_16 || value > max_16) {
            type = thrift.annotationType.I32;
            buf = new Buffer(4);
            buf.writeInt32BE(value, 0);
        } else {
            type = thrift.annotationType.I16;
            buf = new Buffer(2);
            buf.writeInt16BE(value, 0);
        }

        return this.createBinaryAnnotation(key, buf, type);
    }

    /**
     * @param {number} timestamp - number to be stored in this annotation
     * @param {string} value - the string value stored in this annotation
     * @param {Endpoint} host - the Endpoint stored in this annotation
     * @return {Annotation} - an annotation representing the parameters received.
     **/
    static createAnnotation(timestamp: number, value: string , host?: Endpoint): Annotation {
        return {
            timestamp: timestamp,
            value: value,
            host: host
        };
    }

    /**
     * A function which creates logged data which is backed by a zipkin annotation.
     *
     * @param {number} timestamp - number to be stored in this log
     * @param {string} name - the name stored in this log 
     * @param {Endpoint} host - the Endpoint stored in this log
     * @return {Annotation} - an annotation representing the parameters received.
     **/
    static createLogData(timestamp: number, name: string, host?: Endpoint): Annotation {
        return this.createAnnotation(timestamp, name, host);
    }

    /**
     * A function which creates boolean tags backed by zipkin binary annotations
     *
     * @param {string} key - number to be stored in this log
     * @param {boolean} value - the name stored in this log 
     * @return {BinaryAnnotation} - a string tag represented by a binary annotation.
     **/
    static createBooleanTag(key: string, value: boolean): BinaryAnnotation {
        let booleanValue = '0x0';
        if (value) {
            booleanValue = '0x1';
        }

        return this.createBinaryAnnotation(key, booleanValue, thrift.annotationType.BOOL);
    }

    /**
     * A function which creates string tags backed by zipkin binary annotations
     *
     * @param {string} key - number to be stored in this log.
     * @param {boolean} value - the name stored in this log 
     * @return {BinaryAnnotation} - a string tag represented by a binary annotation.
     **/
    static createStringTag(key: string, value: string): BinaryAnnotation {
        return this.createBinaryAnnotation(key, value, thrift.annotationType.STRING);
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
}

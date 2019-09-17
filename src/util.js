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
import http from 'http';

export default class Utils {
  /**
   * Determines whether a string contains a given prefix.
   *
   * @param {string} text - the string for to search for a prefix
   * @param {string} prefix - the prefix to search for in the text given.
   * @return {boolean} - boolean representing whether or not the
   * string contains the prefix.
   **/
  static startsWith(text: string, prefix: string): boolean {
    return text.indexOf(prefix) === 0;
  }

  /**
   * Determines whether a string contains a given suffix.
   *
   * @param {string} text - the string for to search for a suffix
   * @param {string} suffix - the suffix to search for in the text given.
   * @return {boolean} - boolean representing whether or not the
   * string contains the suffix.
   **/
  static endsWith(text: string, suffix: string): boolean {
    return text.lastIndexOf(suffix) === text.length - suffix.length;
  }

  /**
   * Get a random buffer representing a random 64 bit.
   *
   * @return {Buffer}  - returns a buffer representing a random 64 bit
   * number.
   **/
  static getRandom64(): Buffer {
    let randint = xorshift.randomint();
    let buf = this.newBuffer(8);
    buf.writeUInt32BE(randint[0], 0);
    buf.writeUInt32BE(randint[1], 4);
    return buf;
  }

  /**
   * Get a random buffer representing a random 128 bit.
   *
   * @return {Buffer}  - returns a buffer representing a random 128 bit
   * number.
   **/
  static getRandom128(): Buffer {
    let randint1 = xorshift.randomint();
    let randint2 = xorshift.randomint();
    let buf = this.newBuffer(16);
    buf.writeUInt32BE(randint1[0], 0);
    buf.writeUInt32BE(randint1[1], 4);
    buf.writeUInt32BE(randint2[0], 8);
    buf.writeUInt32BE(randint2[1], 12);
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
   * @param {string} input - trace id (e.g. traceIdStr) for which leading zeros should be added.
   * @return {string} - returns the id string 32 or 16 characters long.
   **/
  static padTraceIdStrWithZeros(input: string) {
    if (!input) {
      return input;
    }

    // make sure that the string is 32 or 16 characters long to generate the
    // corresponding 64 or 128 bits buffer by padding the start with zeros if necessary
    // https://github.com/jaegertracing/jaeger/issues/1657
    // At the same time this will enforce that the HEX has an even number of digits, node is expecting 2 HEX characters per byte
    // https://github.com/nodejs/node/issues/21242
    const traceIdExactLength = input.length > 16 ? 32 : 16;
    if (input.length === traceIdExactLength) {
      return input;
    } else {
      const padding = traceIdExactLength === 16 ? '0000000000000000' : '00000000000000000000000000000000';
      return (padding + input).slice(-traceIdExactLength);
    }
  }

  static myIp(): string {
    let myIp = '0.0.0.0';
    let ifaces = os.networkInterfaces();
    let keys = Object.keys(ifaces);
    loop1: for (let i = 0; i < keys.length; i++) {
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
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = obj[key];
      }
    }

    return newObj;
  }

  static convertObjectToTags(dict: any): Array<Tag> {
    let tags: Array<Tag> = [];
    for (let key in dict) {
      let value = dict[key];
      if (Object.prototype.hasOwnProperty.call(dict, key)) {
        tags.push({ key: key, value: value });
      }
    }

    return tags;
  }

  static httpGet(host: string, port: number, path: string, success: Function, error: Function) {
    http
      .get(
        {
          host: host,
          port: port,
          path: path,
        },
        res => {
          // explicitly treat incoming data as utf8 (avoids issues with multi-byte chars)
          res.setEncoding('utf8');

          // incrementally capture the incoming response body
          let body = '';
          res.on('data', chunk => {
            body += chunk;
          });

          res.on('end', () => {
            success(body);
          });
        }
      )
      .on('error', err => {
        error(err);
      });
  }

  /**
   * @param {string|number} input - a hex encoded string to store in the buffer.
   * @return {Buffer} - returns a buffer representing the hex encoded string.
   **/
  static newBufferFromHex(input: string): Buffer {
    const encoding = 'hex';
    // check that 'Buffer.from' exists based on node's documentation
    // https://nodejs.org/en/docs/guides/buffer-constructor-deprecation/#variant-3
    if (Buffer.from && Buffer.from !== Uint8Array.from) {
      return Buffer.from(input, encoding);
    }
    return new Buffer(input, encoding);
  }

  /**
   * @param {number} input - a number of octets to allocate.
   * @return {Buffer} - returns an empty buffer.
   **/
  static newBuffer(size: number): Buffer {
    if (Buffer.alloc) {
      return Buffer.alloc(size);
    }
    const buffer = new Buffer(size);
    buffer.fill(0);
    return buffer;
  }

  /**
   * Creates a callback function that only delegates to passed <code>callback</code>
   * after <code>limit</code> invocations. Useful in types like CompositeReporter that
   * needs to invoke the top level callback only after all delegates' close() methods
   * are called.
   */
  static countdownCallback(limit: number, callback: ?() => void): () => void {
    let count = 0;
    return () => {
      count++;
      if (count >= limit && callback) {
        callback();
      }
    };
  }
}

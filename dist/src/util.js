'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _xorshift = require('xorshift');

var _xorshift2 = _interopRequireDefault(_xorshift);

var _nodeInt = require('node-int64');

var _nodeInt2 = _interopRequireDefault(_nodeInt);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Utils = function () {
    function Utils() {
        _classCallCheck(this, Utils);
    }

    _createClass(Utils, null, [{
        key: 'startsWith',

        /**
         * Determines whether a string contains a given prefix.
         *
         * @param {string} text - the string for to search for a prefix
         * @param {string} prefix - the prefix to search for in the text given.
         * @return {boolean} - boolean representing whehter or not the
         * string contains the prefix.
         **/
        value: function startsWith(text, prefix) {
            return text.indexOf(prefix) === 0;
        }

        /**
         * Determines whether a string contains a given prefix.
         *
         * @return {Buffer}  - returns a buffer representing a random 64 bit
         * number.
         **/

    }, {
        key: 'getRandom64',
        value: function getRandom64() {
            var randint = _xorshift2.default.randomint();
            var buf = new Buffer(8);
            buf.writeUInt32BE(randint[0], 0);
            buf.writeUInt32BE(randint[1], 4);
            return buf;
        }

        /**
         * @param {string|number} numberValue - a string or number to be encoded
         * as a 64 bit byte array.
         * @return {Buffer} - returns a buffer representing the encoded string, or number.
         **/

    }, {
        key: 'encodeInt64',
        value: function encodeInt64(numberValue) {
            return new _nodeInt2.default(numberValue).toBuffer();
        }

        /**
         * @param {string} ip - a string representation of an ip address.
         * @return {number} - a 32-bit number where each byte represents an
         * octect of an ip address.
         **/

    }, {
        key: 'ipToInt',
        value: function ipToInt(ip) {
            var ipl = 0;
            var parts = ip.split('.');
            if (parts.length != 4) {
                return null;
            }

            for (var i = 0; i < parts.length; i++) {
                ipl <<= 8;
                ipl += parseInt(parts[i], 10);
            }

            var signedLimit = 0x7fffffff;
            if (ipl > signedLimit) {
                return (1 << 32) - ipl;
            }
            return ipl;
        }

        /**
         * @param {string} input - the input for which leading zeros should be removed.
         * @return {string} - returns the input string without leading zeros.
         **/

    }, {
        key: 'removeLeadingZeros',
        value: function removeLeadingZeros(input) {
            var counter = 0;
            var length = input.length - 1;
            for (var i = 0; i < length; i++) {
                if (input.charAt(i) === '0') {
                    counter++;
                } else {
                    break;
                }
            }

            return input.substring(counter);
        }
    }, {
        key: 'myIp',
        value: function myIp() {
            var myIp = '0.0.0.0';
            var ifaces = _os2.default.networkInterfaces();
            var keys = Object.keys(ifaces);
            loop1: for (var i = 0; i < keys.length; i++) {
                var iface = ifaces[keys[i]];
                for (var j = 0; j < iface.length; j++) {
                    if (iface[j].family === 'IPv4' && !iface[j].internal) {
                        myIp = iface[j].address;
                        break loop1;
                    }
                }
            }
            return myIp;
        }
    }, {
        key: 'clone',
        value: function clone(obj) {
            var newObj = {};
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    newObj[key] = obj[key];
                }
            }

            return newObj;
        }
    }, {
        key: 'convertObjectToTags',
        value: function convertObjectToTags(dict) {
            var tags = [];
            for (var key in dict) {
                var value = dict[key];
                if (dict.hasOwnProperty(key)) {
                    tags.push({ 'key': key, 'value': value });
                }
            }

            return tags;
        }
    }]);

    return Utils;
}();

exports.default = Utils;
//# sourceMappingURL=util.js.map
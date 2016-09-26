'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _long = require('long');

var _long2 = _interopRequireDefault(_long);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _xorshift = require('xorshift');

var _xorshift2 = _interopRequireDefault(_xorshift);

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
         * @return {object}  - returns a Long representing a random 64 bit
         * number.
         **/

    }, {
        key: 'getRandom64',
        value: function getRandom64() {
            var randint = _xorshift2.default.randomint();
            var unsigned = true;
            return new _long2.default(randint[0], randint[1], unsigned);
        }
    }, {
        key: 'encodeInt64',
        value: function encodeInt64(lower, higher) {
            var unsigned = true;
            return new _long2.default(lower, higher, unsigned);
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
                return (1 << 31) - ipl;
            }
            return ipl;
        }

        /**
         * @param {string} serviceName - the service name of the endpoint
         * @param {string} ipv4 - the ip address of the endpoint
         * @param {number} port - the port of the endpoint
         * @return {Endpoint} - an endpoint object representing the 3 parameters
         * received.
         **/

    }, {
        key: 'createEndpoint',
        value: function createEndpoint(serviceName, ipv4, port) {
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

    }, {
        key: 'getTimestampMicros',
        value: function getTimestampMicros() {
            // TODO(oibe) investigate process.hrtime.  I'm not sure if its in all node versions.
            // http://stackoverflow.com/questions/11725691/how-to-get-a-microtime-in-node-js
            return Date.now() * 1000;
        }
    }, {
        key: 'myIp',
        value: function myIp() {
            var ifaces = _os2.default.networkInterfaces();
            var keys = Object.keys(ifaces);
            for (var i = 0; i < keys.length; i++) {
                var iface = ifaces[keys[i]];
                for (var j = 0; j < iface.length; j++) {
                    if (iface[j].family === 'IPv4' && !iface[j].internal) {
                        return iface[j].address;
                    }
                }
            }
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
        key: 'parseHex64',
        value: function parseHex64(inputStr) {
            var unsigned = true;

            for (var i = 0; i < inputStr.length; i++) {
                var c = inputStr[0];
                if (!(c >= '0' && c <= '9' || c >= 'A' && c <= 'F' || c >= 'a' && c <= 'f')) {
                    return Number.NaN;
                }
            }

            return _long2.default.fromString(inputStr, unsigned, 16);
        }
    }]);

    return Utils;
}();

exports.default = Utils;
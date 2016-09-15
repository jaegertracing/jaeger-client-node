'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

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

var CLIENT_SEND = exports.CLIENT_SEND = 'cs';
var CLIENT_RECV = exports.CLIENT_RECV = 'cr';
var SERVER_SEND = exports.SERVER_SEND = 'ss';
var SERVER_RECV = exports.SERVER_RECV = 'sr';
var LOCAL_COMPONENT = exports.LOCAL_COMPONENT = 'lc';
var CLIENT_ADDR = exports.CLIENT_ADDR = 'ca';
var SERVER_ADDR = exports.SERVER_ADDR = 'sa';
var annotationType = exports.annotationType = {
    BOOL: 'BOOL',
    BYTES: 'BYTES',
    I16: 'I16',
    I32: 'I32',
    I64: 'I64',
    DOUBLE: 'DOUBLE',
    STRING: 'STRING'
};
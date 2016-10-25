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

'use strict';

var xorshift = require('xorshift');

module.exports = Span;
module.exports.Endpoint = Endpoint;
module.exports.Annotation = Annotation;
module.exports.BinaryAnnotation = BinaryAnnotation;

function Span(options) {
    // TODO: options validation

    if (options.id) {
        this.id = options.id;
    }

    if (options.traceid) {
        this.traceid = options.traceid;
    }

    this.endpoint = options.endpoint;

    this.name = options.name;
    this.parentid = options.parentid;
    if (!options.parentid) {
        this.parentid = [0, 0];
    }
    this.annotations = [];
    this.binaryAnnotations = [];
    this.serviceName = options.serviceName;
    this.flags = options.flags;
}

Span.prototype.toString = function toString() {
    var strAnnotations = this.annotations.map(function eachAnn(ann) {
        return '[' + ann.value + ' ' + ann.timestamp + ']';
    }).join(' ');
    return 'SPAN: traceid: ' + this.traceid.toString('hex') + ' spanid: ' +
        this.id.toString('hex') + ' parentid: ' +
        this.parentid.toString('hex') + ' name: ' + this.name +
        ' servicename: ' + this.endpoint.serviceName +
        ' annotations: ' + strAnnotations;
};

Span.prototype.toJSON = function toJSON() {
    return {
        name: this.name,
        endpoint: this.endpoint,
        traceid: this.traceid,
        parentid: this.parentid,
        spanid: this.id,
        annotations: this.annotations,
        binaryAnnotations: this.binaryAnnotations
    };
};

// Generate a trace/span id for this span
Span.prototype.generateIds = function generateIds() {
    this.id = this.traceid = xorshift.randomint();
};

// Generate just a span id
Span.prototype.generateSpanid = function generateSpanid() {
    this.id = xorshift.randomint();
};

// ##
Span.prototype.propagateIdsFrom = function propagateIdsFrom(span) {
    this.parentid = span.id;
    this.traceid = span.traceid;
    this.flags = span.flags;
};

Span.prototype.getTracing = function getTracing() {
    return {
        spanid: this.id,
        traceid: this.traceid,
        parentid: this.parentid,
        flags: this.flags
    };
};

Span.prototype.annotate = function annotate(value, timestamp) {
    timestamp = timestamp || Date.now();
    this.annotations.push(new Annotation(value, this.endpoint, timestamp));
};

Span.prototype.annotateBinary =
function annotateBinary(key, value, type) {
    this.binaryAnnotations.push(new BinaryAnnotation(key, value, type, this.endpoint));
};

function Endpoint(ipv4, port, serviceName) {
    this.ipv4 = ipv4;
    this.port = port;
    this.serviceName = serviceName;
}

function Annotation(value, host, timestamp) {
    // TODO: validation
    this.value = value;
    this.timestamp = timestamp || Date.now();
    this.host = host;
}

function BinaryAnnotation(key, value, type, host) {
    // TODO: validation
    this.key = key;
    this.value = value;
    this.type = type ? type : typeof value;
    this.host = host;
}

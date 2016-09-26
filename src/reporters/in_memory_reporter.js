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

import Span from '../span.js';

export default class InMemoryReporter {
    _spans: Array<Span>;
    _flushed: Array<Span>;
    _process: Process;
    _sender: Sender

    constructor(sender: Sender) {
        this._spans = [];
        this._flushed = [];
        this._sender = sender;
    }

    report(span: Span): void {
        this._spans.push(span);
    }

    get spans(): Array<Span> {
        return this._spans;
    }

    clear(): void {
        this._spans = [];
    }

    flush(callback: ?Function): void {
        for (let i = 0; i < this._spans.length; i++) {
            this._flushed.push(this._spans[i]);
        }

        if (callback) {
            callback();
        }
    }

    close(callback: ?Function): void {
        if(callback) {
            callback();
        }
    }

    setProcess(process: Process): void {
        this._process = process;
        if (this._sender) {
            this._sender.setProcess(process);
        }
    }
}

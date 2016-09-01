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

import express from 'express';

export default class SamplingServer {
    constructor(port=5778) {
        this._port = port
        this._app = express();
        this._setupResponses();
    }

    _setupResponses(){
        this._app.get('/', function (req, res) {
            let service = req.query.service;
            if (service === 'probabilistic-service') {
                res.send({
                    strategyType: 0,
                    probabilisticSampling: {
                        samplingRate: 1.0
                    }
                });
            } else if (service === 'ratelimiting-service') {
                res.send({
                    strategyType: 1,
                    rateLimitingSampling: {
                        maxTracesPerSecond: 10
                    }
                });
            } else if (service === 'updated-probabilistic') {
                res.send({
                    strategyType: 0,
                    probabilisticSampling: {
                        samplingRate: 0.5
                    }
                });
            } else {
                res.status(500).send({err: 'bad things happened'});
            }
        });
    }

    start() {
        return this._app.listen(this._port);
    }

    close() {
        this._app.close();
    }
}

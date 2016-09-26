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

import bodyParser from 'body-parser';
import ConstSampler from '../../src/samplers/const_sampler.js';
import * as constants from './constants.js';
import dns from 'dns';
import express from 'express';
import InMemoryReporter from '../../src/reporters/in_memory_reporter.js';
import opentracing from 'opentracing';
import request from 'request';
import RSVP from 'rsvp';
import Span from '../../src/span.js';
import SpanContext from '../../src/span_context.js';
import Tracer from '../../src/tracer.js';
import Utils from '../../src/util.js';

export default class HttpServer {
    _tracer: Tracer;

    constructor() {
        let app = express();
        this._tracer = new Tracer('crossdock', new InMemoryReporter(), new ConstSampler(false));

        // json responses need bodyParser when working with express
        app.use(bodyParser.json());

        app.post('/start_trace', (req, res) => {
            let startRequest = req.body;
            console.log('start_trace_request:', startRequest);

            // create or deserialize a span from the headers
            let spanContext = this._tracer.extract(opentracing.FORMAT_HTTP_HEADERS, req.headers);
            console.log('start_trace_extract_span_context:', spanContext);
            let serverSpan = this._tracer.startSpan('start-trace', { childOf: spanContext });

            // set sampling and baggage on the span
            serverSpan.setBaggageItem(constants.BAGGAGE_KEY, startRequest.baggage);
            if (startRequest.sampled) {
                serverSpan._setSamplingPriority(1);
            }
            console.log('start_trace_server_span_context:', serverSpan.context());

            // do async call to prepareResponse
            let promise = new RSVP.Promise((resolve, reject) => {
                this.prepareResponse(startRequest.downstream, { span: serverSpan }).then((response) => {
                    resolve(response)
                });
            });

            // then return result of prepareResponse
            promise.then((response) => {
                let traceResponse = JSON.stringify(response);
                console.log('start_trace_response:', traceResponse);
                res.send(traceResponse);
            });
        });

        app.post('/join_trace', (req, res) => {
            let joinTraceRequest = req.body;
            console.log('join_trace_request:', joinTraceRequest);

            // create or deserialize a span from the headers
            console.log('join_trace_headers:', req.headers);
            let spanContext = this._tracer.extract(opentracing.FORMAT_HTTP_HEADERS, req.headers);
            console.log('join_trace_extract_span_context:', spanContext);
            let serverSpan = this._tracer.startSpan('join-trace', { childOf: spanContext });
            console.log('join_trace_server_span_context:', serverSpan.context());

            // do async call to prepareResponse
            let promise = new RSVP.Promise((resolve, reject) => {
                this.prepareResponse(joinTraceRequest.downstream, {span: serverSpan}).then((response) => {
                    resolve(response);
                });
            });

            // then return result of prepareResponse
            promise.then((response) => {
                let traceResponse = JSON.stringify(response);
                console.log('join_trace_response:', traceResponse);
                res.send(traceResponse);
            });
        });

        app.listen(8081, () => {
            console.log('HTTP server listening on port 8081...');
        });
    }

    prepareResponse(downstream: Downstream, context: any): any {
        return new RSVP.Promise((resolve, reject) => {
            let observedSpan = this.observeSpan(context);
            let response: TraceResponse = {
                span: observedSpan,
                notImplementedError: ''
            };

            if (downstream) {
                this.callDownstream(downstream, context).then((downstreamResponse) => {
                    response.downstream = downstreamResponse;
                    resolve(response);
                });
            } else {
                resolve(response);
            }

        });
    }

    callDownstream(downstream: Downstream, context: any): any {
        let transport = downstream.transport;
        if (transport === constants.TRANSPORT_HTTP) {
            return this.callDownstreamHTTP(downstream, context);
        } else if (transport === constants.TRANSPORT_TCHANNEL) {
            return new RSVP.Promise((resolve, reject) => {
                resolve({ 'notImplementedError': 'TChannel has not been implemented' });
            });
        } else if (transport == constants.TRANSPORT_DUMMY) {
            return new RSVP.Promise((resolve, reject) => {
                resolve({ 'notImplementedError': 'Dummy has not been implemented' });
            });
        } else {
            return new RSVP.Promise((resolve, reject) => {
                resolve({ 'notImplementedError': `Unrecognized transport received: ${transport}` })
            });
        }
    }

    callDownstreamHTTP(downstream: Downstream, context: any): any {
        return new RSVP.Promise((resolve, reject) => {

            // $FlowIgnore - Honestly don't know why flow compalins about family.
            dns.lookup(downstream.host, (err, address, family) => {
                if (err) {
                    return;
                }

                let port = parseInt(downstream.port);
                let downstreamUrl = `http:\/\/${address}:${port}/join_trace`;

                let clientSpan = this._tracer.startSpan('client-span', { childOf: context.span.context() });
                context.span = clientSpan;
                let headers = { 'Content-Type': 'application/json' };
                this._tracer.inject(clientSpan.context(), opentracing.FORMAT_HTTP_HEADERS, headers);
                console.log('call_downstream_http:', downstreamUrl);
                console.log('call_downstream_carrier:', headers);

                request.post({
                    'url': downstreamUrl,
                    'forever': true,
                    'headers': headers,
                    'body': JSON.stringify({
                        'serverRole': downstream.serverRole,
                        'downstream': downstream.downstream
                    })
                }, (err, response) => {
                    if (err) {
                        console.log('error in downstream call:', err);
                        reject(err);
                        return;
                    }

                    clientSpan.finish();
                    let downstreamResponse = JSON.parse(response.body);
                    resolve(downstreamResponse);
                });

            });
        });
    }

    observeSpan(context: any): ObservedSpan {
        console.log('observe_span_context', context);
        let span = context.span;
        if (!span) {
            return {
                traceId: 'no span found',
                sampled: false,
                baggage: 'no span found'
            };
        }

        return {
            traceId: Utils.removeLeadingZeros(span.context().traceId.toString('hex')),
            sampled: context.span.context().isSampled(),
            baggage: span.getBaggageItem(constants.BAGGAGE_KEY)
        };
    }
}

if (require.main === module) {
    let http = new HttpServer();
}

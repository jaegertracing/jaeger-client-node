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

import * as constants from './constants.js';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import opentracing from 'opentracing';
import request from 'request';
import RSVP from 'rsvp';
import Span from '../../src/span.js';
import SpanContext from '../../src/span_context.js';
import TChannel from 'tchannel/channel';
import TChannelThrift from 'tchannel/as/thrift';
import TChannelBridge from '../../src/tchannel_bridge';
import Utils from '../../src/util.js';

export default class Helpers {
    _tracer: Tracer;
    _thriftChannel: TChannelThrift;

    constructor(tracer: Tracer) {
        this._tracer = tracer;
        let crossdockSpec = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'jaeger-idl', 'thrift', 'crossdock', 'tracetest.thrift'), 'utf8');
        var channel = TChannel().makeSubChannel({
            serviceName: 'node',
            peers: [Utils.myIp() + ':8082']
        });
        this._thriftChannel = TChannelThrift({
            channel: channel,
            source: crossdockSpec
        });
    }

    handleRequest(startRequest: boolean, endpointLabel: string, traceRequest: any, spanContext: SpanContext): void {
        let serverSpan = this._tracer.startSpan(endpointLabel, { childOf: spanContext });

        if (startRequest) {
            serverSpan.setBaggageItem(constants.BAGGAGE_KEY, traceRequest.baggage);
            if (traceRequest.sampled) {
                serverSpan.setTag(opentracing.Tags.SAMPLING_PRIORITY, 1);
            }
        }

        // do async call to prepareResponse
        return new RSVP.Promise((resolve, reject) => {
            this.prepareResponse(traceRequest.downstream, {span: serverSpan}).then((response) => {
                serverSpan.finish();
                resolve(response);
            });
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
            return this.callDownstreamTChannel(downstream, context);
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
                    console.log('dns_lookup_err', err);
                    return;
                }

                let port = parseInt(downstream.port);
                let downstreamUrl = `http:\/\/${address}:${port}/join_trace`;

                let clientSpan = this._tracer.startSpan('client-span', { childOf: context.span.context() });
                let headers = { 'Content-Type': 'application/json' };
                this._tracer.inject(clientSpan.context(), opentracing.FORMAT_HTTP_HEADERS, headers);

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
                        clientSpan.finish();
                        return;
                    }

                    clientSpan.finish();
                    let downstreamResponse = JSON.parse(response.body);
                    resolve(downstreamResponse);
                });

            });
        });
    }

    callDownstreamTChannel(downstream: Downstream, context: any): any {
        return new RSVP.Promise((resolve, reject) => {
            dns.lookup(downstream.host, (err, address, family) => {
                if (err) {
                    console.log('dns_lookup_err', err);
                    return;
                }

                let port = parseInt(downstream.port);
                let downstreamUrl = `http:\/\/${address}:${port}/join_trace`;

                let clientSpan = this._tracer.startSpan('client-span', { childOf: context.span.context() });

                // Save client span to tchannel headers
                let headers = { 'Content-Type': 'application/json' };
                TChannelBridge.saveTracerStateToCarrier(clientSpan, headers);
                TChannelBridge.saveBaggageToCarrier(clientSpan, headers);

                let request = this._thriftChannel.request({
                    timeout: 2000,
                    parent: { span: TChannelBridge.getTChannelParentSpan() },
                    headers: {
                        cn: 'tcollector-requestor'
                    },
                    trace: true,
                    serviceName: 'node',
                    retryFlags: {never: true}
                });
                let joinTraceRequest = {
                    'serverRole': downstream.serverRole,
                };

                if (downstream.downstream) {
                    joinTraceRequest.downstream = downstream.downstream;
                }

                request.send(
                    'TracedService::joinTrace',
                    headers,
                    { request: joinTraceRequest },
                    (err, response) => {
                        if (err) {
                            console.log('tchannel err', err);
                            clientSpan.finish();
                            return;
                        }
                        clientSpan.finish();
                        resolve(response.body);
                });
            });
        });
    }

    observeSpan(context: any): ObservedSpan {
        let span = context.span;
        if (!span) {
            return {
                traceId: 'no span found',
                sampled: false,
                baggage: 'no span found'
            };
        }

        return {
            traceId: span.context().traceIdStr,
            sampled: context.span.context().isSampled(),
            baggage: span.getBaggageItem(constants.BAGGAGE_KEY)
        };
    }
}

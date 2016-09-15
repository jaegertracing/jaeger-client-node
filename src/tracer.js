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

import BinaryCodec from './propagators/binary_codec.js';
import ConstSampler from './samplers/const_sampler.js';
import * as constants from './constants.js';
import * as opentracing from 'opentracing';
import {Tags as opentracing_tags} from 'opentracing';
import NoopReporter from './reporters/noop_reporter.js';
import pjson from '../package.json';
import Span from './span.js';
import SpanContext from './span_context.js';
import TextMapCodec from './propagators/text_map_codec.js';
import NullLogger from './logger.js';
import Utils from './util.js';

export default class Tracer {
    _serviceName: string;
    _reporter: Reporter;
    _sampler: Sampler;
    _logger: NullLogger;
    _tags: any;
    _injectors: any;
    _extractors: any;

    constructor(serviceName: string,
            reporter: Reporter = new NoopReporter(),
            sampler: Sampler = new ConstSampler(false),
            logger: any,
            tags: any = {}) {
        this._tags = tags;
        this._tags[constants.JAEGER_CLIENT_VERSION_TAG_KEY] = `Node-${pjson.version}`;
        this._tags[constants.TRACER_HOSTNAME_TAG_KEY] = Utils.myIp();

        this._serviceName = serviceName;
        this._reporter = reporter;
        this._sampler = sampler;
        this._logger = logger || new NullLogger();
        this._injectors = {};
        this._extractors = {};

        let textCodec = new TextMapCodec(false);
        this.registerInjector(opentracing.FORMAT_TEXT_MAP, textCodec);
        this.registerExtractor(opentracing.FORMAT_TEXT_MAP, textCodec);

        let httpCodec = new TextMapCodec(true);
        this.registerInjector(opentracing.FORMAT_HTTP_HEADERS, httpCodec);
        this.registerExtractor(opentracing.FORMAT_HTTP_HEADERS, httpCodec);

        let binaryCodec = new BinaryCodec();
        this.registerInjector(opentracing.FORMAT_BINARY, binaryCodec);
        this.registerExtractor(opentracing.FORMAT_BINARY, binaryCodec);
    }

    _startInternalSpan(
            spanContext: SpanContext,
            operationName: string,
            startTime: number,
            internalTags: any = {},
            tags: any = {},
            rpcServer: boolean): Span {

        let firstInProcess = rpcServer || (spanContext.parentId == null);
        let span = new Span(
            this,
            operationName,
            spanContext,
            startTime,
            firstInProcess
        );

        span.addTags(tags);
        span.addTags(internalTags);
        return span;
    }

    _report(span: Span): void {
        if (span.firstInProcess) {
            span.addTags(this._tags);
        }

        this._reporter.report(span);
    }

    registerInjector(format: string, injector: Injector): void {
        this._injectors[format] = injector;
    }

    registerExtractor(format: string, extractor: Extractor): void {
        this._extractors[format] = extractor;
    }

    /**
    * The method for creating a root or child span.
    *
    * @param {string} name - the name of the operation.
    * @param {object} [fields] - the fields to set on the newly created span.
    * @param {string} fields.operationName - the name to use for the newly
    *        created span. Required if called with a single argument.
    * @param {SpanContext} [fields.childOf] - a parent SpanContext (or Span,
    *        for convenience) that the newly-started span will be the child of
    *        (per REFERENCE_CHILD_OF). If specified, `fields.references` must
    *        be unspecified.
    * @param {array} [fields.references] - an array of Reference instances,
    *        each pointing to a causal parent SpanContext. If specified,
    *        `fields.childOf` must be unspecified.
    * @param {object} [fields.tags] - set of key-value pairs which will be set
    *        as tags on the newly created Span. Ownership of the object is
    *        passed to the created span for efficiency reasons (the caller
    *        should not modify this object after calling startSpan).
    * @param {number} [fields.startTime] - a manually specified start time for
    *        the created Span object. The time should be specified in
    *        milliseconds as Unix timestamp. Decimal value are supported
    *        to represent time values with sub-millisecond accuracy.
    * @return {Span} - a new Span object.
    **/
    startSpan(operationName: string, fields: startSpanArgs): Span {
        // Convert fields.childOf to fields.references as needed.
        fields = fields || {};
        fields.operationName = operationName;

        let tags = fields.tags || {};
        let references = fields.references || [];
        let startTime = fields.startTime;
        if (!startTime) {
            startTime = Utils.getTimestampMicros();
        }

        // TODO(oibe) support use of references
        let parent: ?SpanContext = fields.childOf;
        if (!parent) {
            // If there is no childOf in fields, then search list of references
            for (let i = 0; i < references.length; i++) {
                let ref: Reference = references[i];
                let ref_type = ref.type();
                if ((ref_type === opentracing.REFERENCE_CHILD_OF) ||
                    (ref_type === opentracing.REFERENCE_FOLLOWS_FROM)) {
                    parent = ref.referencedContext();
                    break;
                } else {
                    // TODO(oibe) support other types of span references
                }
            }
        }

        let spanKindValue = tags[opentracing_tags.SPAN_KIND];
        let rpcServer = (spanKindValue === opentracing_tags.SPAN_KIND_RPC_SERVER);


        // $FlowIgnore - I just want a span context up front.
        let ctx: SpanContext = new SpanContext();
        let samplerTags: any = {};
        if (!parent) {
            let randomId = Utils.getRandom64();
            let flags = 0;
            if (this._sampler.isSampled()) {
                flags |= constants.SAMPLED_MASK;
                samplerTags = this._sampler.getTags();
            }

            ctx.traceId = randomId;
            ctx.spanId = randomId;
            ctx.parentId = null;
            ctx.flags = flags;
        } else {
            ctx.traceId = parent.traceId;
            if (rpcServer) {
                // Support Zipkin's one-span-per-RPC model
                ctx.spanId = parent.spanId;
                ctx.parentId = parent.parentId;
            } else {
                ctx.spanId = Utils.getRandom64();
                ctx.parentId = parent.spanId;
            }
            ctx.flags = parent.flags;

            // reuse parent's baggage as we'll never change it
            ctx.baggage = parent.baggage;
        }

        return this._startInternalSpan(
            ctx,
            fields.operationName,
            startTime,
            samplerTags,
            tags,
            rpcServer
        );
    }

    /**
     * Saves the span context into the carrier object for various formats, and encoders.
     *
     * @param  {SpanContext} spanContext - the SpanContext to inject into the
     *         carrier object. As a convenience, a Span instance may be passed
     *         in instead (in which case its .context() is used for the
     *         inject()).
     * @param  {string} format - the format of the carrier.
     * @param  {any} carrier - see the documentation for the chosen `format`
     *         for a description of the carrier object.
     **/
    inject(spanContext: SpanContext, format: string, carrier: any): void {
        let injector = this._injectors[format];
        if (!injector) {
            throw new Error(`Unsupported format: ${format}`);
        }

        injector.inject(spanContext, carrier);
    }

    /**
    * Responsible for extracting a span context from various serialized formats.
    *
    * @param  {string} format - the format of the carrier.
    * @param  {any} carrier - the type of the carrier object is determined by
    *         the format.
    * @return {SpanContext}
    *         The extracted SpanContext, or null if no such SpanContext could
    *         be found in `carrier`
    */
    extract(format: string, carrier: any): SpanContext {
        let extractor = this._extractors[format];
        if (!extractor) {
            throw new Error(`Unsupported format: ${format}`);
        }

        return extractor.extract(carrier);
    }

    /**
     * Closes the tracer, flushes spans, and executes any callbacks if necessary.
     *
     * @param {Function} [callback] - a callback that runs after the tracer has been closed.
     **/
    close(callback: Function): void {
        var reporter = this._reporter;
        this._reporter = new NoopReporter();
        reporter.close(() => {
            this._sampler.close(callback);
        });
    }

    /**
     * Writes spans to the local agent, and executes a callback if necessary.
     *
     * @param {Function} [callback] - a callback that runs after spans have been flushed.
     **/
    flush(callback: Function): void {
        this._reporter.flush(callback);
    }
}

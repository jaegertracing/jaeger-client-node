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

import BinaryCodec from './propagators/binary_codec';
import ConstSampler from './samplers/const_sampler';
import * as constants from './constants';
import * as opentracing from 'opentracing';
import pjson from '../package.json';
import {Tags as opentracing_tags} from 'opentracing';
import NoopReporter from './reporters/noop_reporter';
import Span from './span';
import SpanContext from './span_context';
import TextMapCodec from './propagators/text_map_codec';
import NullLogger from './logger';
import Utils from './util';
import Metrics from './metrics/metrics';
import NoopMetricFactory from './metrics/noop/metric_factory';

export default class Tracer {
    _serviceName: string;
    _reporter: Reporter;
    _sampler: Sampler;
    _logger: NullLogger;
    _tags: any;
    _injectors: any;
    _extractors: any;
    _metrics: any;

    constructor(serviceName: string,
            reporter: Reporter = new NoopReporter(),
            sampler: Sampler = new ConstSampler(false),
            options: any = {}) {
        this._tags = options.tags || {};
        this._tags[constants.JAEGER_CLIENT_VERSION_TAG_KEY] = `Node-${pjson.version}`;
        this._tags[constants.TRACER_HOSTNAME_TAG_KEY] = Utils.myIp();

        this._metrics = options.metrics || new Metrics(new NoopMetricFactory());

        this._serviceName = serviceName;
        this._reporter = reporter;
        this._sampler = sampler;
        this._logger = options.logger || new NullLogger();
        this._injectors = {};
        this._extractors = {};

        let textCodec = new TextMapCodec({
            urlEncoding: false,
            metrics: this._metrics
        });
        this.registerInjector(opentracing.FORMAT_TEXT_MAP, textCodec);
        this.registerExtractor(opentracing.FORMAT_TEXT_MAP, textCodec);

        let httpCodec = new TextMapCodec({
            urlEncoding: true,
            metrics: this._metrics
        });
        this.registerInjector(opentracing.FORMAT_HTTP_HEADERS, httpCodec);
        this.registerExtractor(opentracing.FORMAT_HTTP_HEADERS, httpCodec);

        let binaryCodec = new BinaryCodec();
        this.registerInjector(opentracing.FORMAT_BINARY, binaryCodec);
        this.registerExtractor(opentracing.FORMAT_BINARY, binaryCodec);

        this._setProcess();
    }

    _setProcess(): void {
        this._reporter.setProcess(this._serviceName, Utils.convertObjectToTags(this._tags));
    }

    _startInternalSpan(
        spanContext: SpanContext,
        operationName: string,
        startTime: number,
        internalTags: any = {},
        tags: any = {},
        parentContext: ?SpanContext,
        rpcServer: boolean,
        references: Array<Reference>): Span {

        let hadParent = parentContext && !parentContext.isDebugIDContainerOnly();
        let firstInProcess: boolean = rpcServer || (spanContext.parentId == null);
        let span = new Span(
            this,
            operationName,
            spanContext,
            startTime,
            firstInProcess,
            references
        );

        span.addTags(tags);
        span.addTags(internalTags);

        // emit metrics
        this._metrics.spansStarted.increment(1);
        if (span.context().isSampled()) {
            this._metrics.spansSampled.increment(1);
            if (!hadParent) {
                this._metrics.tracesStartedSampled.increment(1);
            } else if (rpcServer) {
                this._metrics.tracesJoinedSampled.increment(1);
            }
        } else {
            this._metrics.spansNotSampled.increment(1);
            if (!hadParent) {
                this._metrics.tracesStartedNotSampled.increment(1);
            } else if (rpcServer) {
                this._metrics.tracesJoinedNotSampled.increment(1);
            }
        }

        return span;
    }

    _report(span: Span): void {
        this._metrics.spansFinished.increment(1);
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
    startSpan(operationName: string, options: ?startSpanArgs): Span {
        // Convert options.childOf to options.references as needed.
        options = options || {};
        options.operationName = operationName;
        options.references = options.references || [];

        let tags = options.tags || {};
        let startTime = options.startTime;
        if (!startTime) {
            startTime = Utils.getTimestampMicros();
        }

        // This flag is used to ensure that CHILD_OF reference is preferred 
        // as a parent even if it comes after FOLLOWS_FROM reference.
        let followsFromIsParent = false;
        let parent: ?SpanContext = options.childOf instanceof Span ? options.childOf.context() : options.childOf;
        // If there is no childOf in options, then search list of references
        for (let i = 0; i < options.references.length; i++) {
            let ref: Reference = options.references[i];
            if (ref.type() === opentracing.REFERENCE_CHILD_OF) {
                if (!parent || followsFromIsParent) {
                    parent = ref.referencedContext();
                    break;
                }
            } else if (ref.type() === opentracing.REFERENCE_FOLLOWS_FROM) {
                if (!parent) {
                    parent = ref.referencedContext();
                    followsFromIsParent = true;
                }
            }
        }

        let spanKindValue = tags[opentracing_tags.SPAN_KIND];
        let rpcServer = (spanKindValue === opentracing_tags.SPAN_KIND_RPC_SERVER);


        let ctx: SpanContext = new SpanContext();
        let samplerTags: any = {};
        if (!parent || !parent.isValid) {
            let randomId = Utils.getRandom64();
            let flags = 0;
            if (parent) {
                if (parent.isDebugIDContainerOnly()) {
                    flags |= (constants.SAMPLED_MASK | constants.DEBUG_MASK);
                    samplerTags[constants.JAEGER_DEBUG_HEADER] = parent.debugId;
                }
                // baggage that could have been passed via `jaeger-baggage` header
                ctx.baggage = parent.baggage;
            } else if (this._sampler.isSampled()) {
                flags |= constants.SAMPLED_MASK;
                samplerTags = this._sampler.getTags();
            }

            ctx.traceId = randomId;
            ctx.spanId = randomId;
            ctx.parentId = null;
            ctx.flags = flags;
        } else {
            ctx.traceId = parent.traceId;
            ctx.spanId = Utils.getRandom64();
            ctx.parentId = parent.spanId;
            ctx.flags = parent.flags;

            // reuse parent's baggage as we'll never change it
            ctx.baggage = parent.baggage;
        }

        return this._startInternalSpan(
            ctx,
            options.operationName,
            startTime,
            samplerTags,
            tags,
            parent,
            rpcServer,
            options.references
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

// @flow
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

import BinaryCodec from './propagators/binary_codec';
import ConstSampler from './samplers/v2/const_sampler';
import adaptSampler from './samplers/_adapt_sampler';
import * as constants from './constants';
import * as opentracing from 'opentracing';
import { Tags as otTags } from 'opentracing';
import NoopReporter from './reporters/noop_reporter';
import Span from './span';
import SpanContext from './span_context';
import TextMapCodec from './propagators/text_map_codec';
import NullLogger from './logger';
import Utils from './util';
import Metrics from './metrics/metrics';
import NoopMetricFactory from './metrics/noop/metric_factory';
import DefaultBaggageRestrictionManager from './baggage/default_baggage_restriction_manager';
import os from 'os';
import BaggageSetter from './baggage/baggage_setter';
import DefaultThrottler from './throttler/default_throttler';
import uuidv4 from 'uuid/v4';
import version from './version';
import SamplingState from './samplers/v2/sampling_state';

export default class Tracer {
  _serviceName: string;
  _reporter: Reporter;
  _sampler: Sampler;
  _logger: NullLogger;
  _tags: any;
  _injectors: any;
  _extractors: any;
  _metrics: any;
  _baggageSetter: BaggageSetter;
  _debugThrottler: Throttler & ProcessSetter;
  _process: Process;

  /**
   * @param {String} [serviceName] - name of the current service or application.
   * @param {Object} [reporter] - reporter used to submit finished spans to Jaeger backend.
   * @param {Object} [sampler] - sampler used to decide if trace should be sampled when starting a new one.
   * @param {Object} [options] - the fields to set on the newly created span.
   * @param {Object} [options.tags] - set of key-value pairs which will be set
   *        as process-level tags on the Tracer itself.
   * @param {Object} [options.metrics] - instance of the Metrics class from ./metrics/metrics.js.
   * @param {Object} [options.logger] - a logger matching NullLogger API from ./logger.js.
   * @param {Object} [options.baggageRestrictionManager] - a baggageRestrictionManager matching
   * @param {Object} [options.contextKey] - a name of the key to extract/inject context from headers
   * @param {Object} [options.baggagePrefix] - a name of the context baggage key prefix
   * BaggageRestrictionManager API from ./baggage.js.
   */
  constructor(
    serviceName: string,
    reporter: Reporter = new NoopReporter(),
    sampler: LegacySamplerV1 | Sampler = new ConstSampler(false),
    options: any = {}
  ) {
    this._tags = options.tags ? Utils.clone(options.tags) : {};
    this._tags[constants.JAEGER_CLIENT_VERSION_TAG_KEY] = `Node-${version}`;
    this._tags[constants.TRACER_HOSTNAME_TAG_KEY] =
      this._tags[constants.TRACER_HOSTNAME_TAG_KEY] || os.hostname();
    this._tags[constants.PROCESS_IP] = this._tags[constants.PROCESS_IP] || Utils.myIp();

    this._metrics = options.metrics || new Metrics(new NoopMetricFactory());

    this._serviceName = serviceName;
    this._reporter = reporter;
    // TODO(joe): verify we want to throw if the sampler is invalid
    this._sampler = adaptSampler.orThrow(sampler);
    this._logger = options.logger || new NullLogger();
    this._baggageSetter = new BaggageSetter(
      options.baggageRestrictionManager || new DefaultBaggageRestrictionManager(),
      this._metrics
    );
    this._debugThrottler = options.debugThrottler || new DefaultThrottler(false);
    this._injectors = {};
    this._extractors = {};

    let codecOptions = {
      contextKey: options.contextKey || null,
      baggagePrefix: options.baggagePrefix || null,
      urlEncoding: false,
      metrics: this._metrics,
    };

    let textCodec = new TextMapCodec(codecOptions);
    this.registerInjector(opentracing.FORMAT_TEXT_MAP, textCodec);
    this.registerExtractor(opentracing.FORMAT_TEXT_MAP, textCodec);

    codecOptions.urlEncoding = true;

    let httpCodec = new TextMapCodec(codecOptions);
    this.registerInjector(opentracing.FORMAT_HTTP_HEADERS, httpCodec);
    this.registerExtractor(opentracing.FORMAT_HTTP_HEADERS, httpCodec);

    let binaryCodec = new BinaryCodec();
    this.registerInjector(opentracing.FORMAT_BINARY, binaryCodec);
    this.registerExtractor(opentracing.FORMAT_BINARY, binaryCodec);

    const uuid = uuidv4();
    this._tags[constants.TRACER_CLIENT_ID_TAG_KEY] = uuid;
    this._process = {
      serviceName: serviceName,
      tags: Utils.convertObjectToTags(this._tags),
      uuid: uuid,
    };
    this._debugThrottler.setProcess(this._process);
    // TODO update reporter to implement ProcessSetter
    this._reporter.setProcess(this._process.serviceName, this._process.tags);
  }

  _startInternalSpan(
    spanContext: SpanContext,
    operationName: string,
    startTime: number,
    userTags: ?{},
    internalTags: ?{},
    references: Array<Reference>,
    hadParent: boolean,
    isRpcServer: boolean
  ): Span {
    const span = new Span(this, operationName, spanContext, startTime, references);
    this._sampler.onCreateSpan(span);

    if (userTags) {
      span.addTags(userTags);
    }
    if (internalTags) {
      span.addTags(internalTags);
    }

    // emit metrics
    if (span.context().isSampled()) {
      this._metrics.spansStartedSampled.increment(1);
      if (!hadParent) {
        this._metrics.tracesStartedSampled.increment(1);
      } else if (isRpcServer) {
        this._metrics.tracesJoinedSampled.increment(1);
      }
    } else {
      this._metrics.spansStartedNotSampled.increment(1);
      if (!hadParent) {
        this._metrics.tracesStartedNotSampled.increment(1);
      } else if (isRpcServer) {
        this._metrics.tracesJoinedNotSampled.increment(1);
      }
    }

    return span;
  }

  _report(span: Span): void {
    this._metrics.spansFinished.increment(1);
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
   * @param {string} operationName - the name of the operation.
   * @param {object} [options] - the fields to set on the newly created span.
   * @param {string} options.operationName - the name to use for the newly
   *        created span. Required if called with a single argument.
   * @param {SpanContext} [options.childOf] - a parent SpanContext (or Span,
   *        for convenience) that the newly-started span will be the child of
   *        (per REFERENCE_CHILD_OF). If specified, `fields.references` must
   *        be unspecified.
   * @param {array} [options.references] - an array of Reference instances,
   *        each pointing to a causal parent SpanContext. If specified,
   *        `fields.childOf` must be unspecified.
   * @param {object} [options.tags] - set of key-value pairs which will be set
   *        as tags on the newly created Span. Ownership of the object is
   *        passed to the created span for efficiency reasons (the caller
   *        should not modify this object after calling startSpan).
   * @param {number} [options.startTime] - a manually specified start time for
   *        the created Span object. The time should be specified in
   *        milliseconds as Unix timestamp. Decimal value are supported
   *        to represent time values with sub-millisecond accuracy.
   * @return {Span} - a new Span object.
   **/
  startSpan(operationName: string, options: ?startSpanOptions): Span {
    // Convert options.childOf to options.references as needed.
    options = options || {};
    let references = options.references;

    let userTags = options.tags;
    let startTime = options.startTime || this.now();

    // This flag is used to ensure that CHILD_OF reference is preferred
    // as a parent even if it comes after FOLLOWS_FROM reference.
    let followsFromIsParent = false;
    let parent: ?SpanContext = options.childOf instanceof Span ? options.childOf.context() : options.childOf;
    // If there is no childOf in options, then search list of references
    if (!parent && references) {
      for (let i = 0; i < references.length; i++) {
        let ref: Reference = references[i];
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
    }

    let ctx: SpanContext;
    let internalTags: {};
    const id = Utils.getRandom64();
    let hasValidParent = false;
    if (parent && parent.isValid) {
      // TODO(joe): verify `hasValidParent`
      // old code was: parentContext && !parentContext.isDebugIDContainerOnly();
      hasValidParent = true;
      ctx = parent._makeChildContext(id);
      // finalize sampling for all span contexts of the parent.traceId trace
      parent.finalizeSampling();
    } else {
      ctx = new SpanContext(id, id);
      if (parent) {
        if (parent.isDebugIDContainerOnly() && this._isDebugAllowed(operationName)) {
          ctx._setIsSampled(true);
          ctx._setIsDebug(true);
          internalTags = {
            [constants.JAEGER_DEBUG_HEADER]: parent.debugId,
          };
        }
        ctx.baggage = parent.baggage;
      }
    }
    const isRpcServer = Boolean(userTags && userTags[otTags.SPAN_KIND] === otTags.SPAN_KIND_RPC_SERVER);
    return this._startInternalSpan(
      ctx,
      operationName,
      startTime,
      userTags,
      internalTags,
      references || [],
      hasValidParent,
      isRpcServer
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
  inject(spanContext: SpanContext | Span, format: string, carrier: any): void {
    if (!spanContext) {
      return;
    }
    const injector = this._injectors[format];
    if (!injector) {
      throw new Error(`Unsupported format: ${format}`);
    }
    const _context = spanContext instanceof Span ? spanContext.context() : spanContext;
    _context.finalizeSampling();
    injector.inject(_context, carrier);
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
    const spanContext = extractor.extract(carrier);
    if (spanContext) {
      spanContext.finalizeSampling();
    }
    return spanContext;
  }

  /**
   * Closes the tracer, flushes spans, and executes any callbacks if necessary.
   *
   * @param {Function} [callback] - a callback that runs after the tracer has been closed.
   **/
  close(callback: Function): void {
    let reporter = this._reporter;
    this._reporter = new NoopReporter();
    reporter.close(() => {
      this._sampler.close(callback);
    });
    this._debugThrottler.close();
  }

  /**
   * Returns the current timestamp in milliseconds since the Unix epoch.
   * Fractional values are allowed so that timestamps with sub-millisecond
   * accuracy can be represented.
   */
  now(): number {
    // TODO investigate process.hrtime; verify it is available in all Node versions.
    // http://stackoverflow.com/questions/11725691/how-to-get-a-microtime-in-node-js
    return Date.now();
  }

  _isDebugAllowed(operation: string): boolean {
    return this._debugThrottler.isAllowed(operation);
  }
}

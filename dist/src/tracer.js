'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _binary_codec = require('./propagators/binary_codec');

var _binary_codec2 = _interopRequireDefault(_binary_codec);

var _const_sampler = require('./samplers/const_sampler');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _constants = require('./constants');

var constants = _interopRequireWildcard(_constants);

var _opentracing = require('opentracing');

var opentracing = _interopRequireWildcard(_opentracing);

var _package = require('../package.json');

var _package2 = _interopRequireDefault(_package);

var _noop_reporter = require('./reporters/noop_reporter');

var _noop_reporter2 = _interopRequireDefault(_noop_reporter);

var _span = require('./span');

var _span2 = _interopRequireDefault(_span);

var _span_context = require('./span_context');

var _span_context2 = _interopRequireDefault(_span_context);

var _text_map_codec = require('./propagators/text_map_codec');

var _text_map_codec2 = _interopRequireDefault(_text_map_codec);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _util = require('./util');

var _util2 = _interopRequireDefault(_util);

var _metrics = require('./metrics/metrics');

var _metrics2 = _interopRequireDefault(_metrics);

var _metric_factory = require('./metrics/noop/metric_factory');

var _metric_factory2 = _interopRequireDefault(_metric_factory);

var _default_baggage_restriction_manager = require('./baggage/default_baggage_restriction_manager');

var _default_baggage_restriction_manager2 = _interopRequireDefault(_default_baggage_restriction_manager);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _baggage_setter = require('./baggage/baggage_setter');

var _baggage_setter2 = _interopRequireDefault(_baggage_setter);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Tracer = function () {

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
     * BaggageRestrictionManager API from ./baggage.js.
     */
    function Tracer(serviceName) {
        var reporter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : new _noop_reporter2.default();
        var sampler = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new _const_sampler2.default(false);
        var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

        _classCallCheck(this, Tracer);

        this._tags = options.tags || {};
        this._tags[constants.JAEGER_CLIENT_VERSION_TAG_KEY] = 'Node-' + _package2.default.version;
        this._tags[constants.TRACER_HOSTNAME_TAG_KEY] = _os2.default.hostname();
        this._tags[constants.PROCESS_IP] = _util2.default.ipToInt(_util2.default.myIp());

        this._metrics = options.metrics || new _metrics2.default(new _metric_factory2.default());

        this._serviceName = serviceName;
        this._reporter = reporter;
        this._sampler = sampler;
        this._logger = options.logger || new _logger2.default();
        this._baggageSetter = new _baggage_setter2.default(options.baggageRestrictionManager || new _default_baggage_restriction_manager2.default(), this._metrics);
        this._injectors = {};
        this._extractors = {};

        var textCodec = new _text_map_codec2.default({
            urlEncoding: false,
            metrics: this._metrics
        });
        this.registerInjector(opentracing.FORMAT_TEXT_MAP, textCodec);
        this.registerExtractor(opentracing.FORMAT_TEXT_MAP, textCodec);

        var httpCodec = new _text_map_codec2.default({
            urlEncoding: true,
            metrics: this._metrics
        });
        this.registerInjector(opentracing.FORMAT_HTTP_HEADERS, httpCodec);
        this.registerExtractor(opentracing.FORMAT_HTTP_HEADERS, httpCodec);

        var binaryCodec = new _binary_codec2.default();
        this.registerInjector(opentracing.FORMAT_BINARY, binaryCodec);
        this.registerExtractor(opentracing.FORMAT_BINARY, binaryCodec);

        this._reporter.setProcess(this._serviceName, _util2.default.convertObjectToTags(this._tags));
    }

    _createClass(Tracer, [{
        key: '_startInternalSpan',
        value: function _startInternalSpan(spanContext, operationName, startTime, userTags, internalTags, parentContext, rpcServer, references) {

            var hadParent = parentContext && !parentContext.isDebugIDContainerOnly();
            var span = new _span2.default(this, operationName, spanContext, startTime, references);

            span.addTags(userTags);
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
    }, {
        key: '_report',
        value: function _report(span) {
            this._metrics.spansFinished.increment(1);
            this._reporter.report(span);
        }
    }, {
        key: 'registerInjector',
        value: function registerInjector(format, injector) {
            this._injectors[format] = injector;
        }
    }, {
        key: 'registerExtractor',
        value: function registerExtractor(format, extractor) {
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

    }, {
        key: 'startSpan',
        value: function startSpan(operationName, options) {
            // Convert options.childOf to options.references as needed.
            options = options || {};
            var references = options.references || [];

            var userTags = options.tags || {};
            var startTime = options.startTime || this.now();

            // This flag is used to ensure that CHILD_OF reference is preferred 
            // as a parent even if it comes after FOLLOWS_FROM reference.
            var followsFromIsParent = false;
            var parent = options.childOf instanceof _span2.default ? options.childOf.context() : options.childOf;
            // If there is no childOf in options, then search list of references
            for (var i = 0; i < references.length; i++) {
                var ref = references[i];
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

            var spanKindValue = userTags[_opentracing.Tags.SPAN_KIND];
            var rpcServer = spanKindValue === _opentracing.Tags.SPAN_KIND_RPC_SERVER;

            var ctx = new _span_context2.default();
            var internalTags = {};
            if (!parent || !parent.isValid) {
                var randomId = _util2.default.getRandom64();
                var flags = 0;
                if (this._sampler.isSampled(operationName, internalTags)) {
                    flags |= constants.SAMPLED_MASK;
                }

                if (parent) {
                    if (parent.isDebugIDContainerOnly()) {
                        flags |= constants.SAMPLED_MASK | constants.DEBUG_MASK;
                        internalTags[constants.JAEGER_DEBUG_HEADER] = parent.debugId;
                    }
                    // baggage that could have been passed via `jaeger-baggage` header
                    ctx.baggage = parent.baggage;
                }

                ctx.traceId = randomId;
                ctx.spanId = randomId;
                ctx.parentId = null;
                ctx.flags = flags;
            } else {
                ctx.traceId = parent.traceId;
                ctx.spanId = _util2.default.getRandom64();
                ctx.parentId = parent.spanId;
                ctx.flags = parent.flags;

                // reuse parent's baggage as we'll never change it
                ctx.baggage = parent.baggage;

                parent.finalizeSampling();
                ctx.finalizeSampling();
            }

            return this._startInternalSpan(ctx, operationName, startTime, userTags, internalTags, parent, rpcServer, references);
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

    }, {
        key: 'inject',
        value: function inject(spanContext, format, carrier) {
            if (!spanContext) {
                return;
            }

            var injector = this._injectors[format];
            if (!injector) {
                throw new Error('Unsupported format: ' + format);
            }

            if (spanContext.context) {
                spanContext = spanContext.context();
            }

            spanContext.finalizeSampling();
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

    }, {
        key: 'extract',
        value: function extract(format, carrier) {
            var extractor = this._extractors[format];
            if (!extractor) {
                throw new Error('Unsupported format: ' + format);
            }

            var spanContext = extractor.extract(carrier);

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

    }, {
        key: 'close',
        value: function close(callback) {
            var _this = this;

            var reporter = this._reporter;
            this._reporter = new _noop_reporter2.default();
            reporter.close(function () {
                _this._sampler.close(callback);
            });
        }

        /**
         * Returns the current timestamp in milliseconds since the Unix epoch.
         * Fractional values are allowed so that timestamps with sub-millisecond
         * accuracy can be represented.
         */

    }, {
        key: 'now',
        value: function now() {
            // TODO investigate process.hrtime; verify it is available in all Node versions.
            // http://stackoverflow.com/questions/11725691/how-to-get-a-microtime-in-node-js
            return Date.now();
        }
    }]);

    return Tracer;
}();

exports.default = Tracer;
//# sourceMappingURL=tracer.js.map
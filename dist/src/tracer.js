'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
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

var _binary_codec = require('./propagators/binary_codec.js');

var _binary_codec2 = _interopRequireDefault(_binary_codec);

var _const_sampler = require('./samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _constants = require('./constants.js');

var constants = _interopRequireWildcard(_constants);

var _opentracing = require('opentracing');

var opentracing = _interopRequireWildcard(_opentracing);

var _noop_reporter = require('./reporters/noop_reporter.js');

var _noop_reporter2 = _interopRequireDefault(_noop_reporter);

var _package = require('../package.json');

var _package2 = _interopRequireDefault(_package);

var _span = require('./span.js');

var _span2 = _interopRequireDefault(_span);

var _span_context = require('./span_context.js');

var _span_context2 = _interopRequireDefault(_span_context);

var _text_map_codec = require('./propagators/text_map_codec.js');

var _text_map_codec2 = _interopRequireDefault(_text_map_codec);

var _logger = require('./logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _util = require('./util.js');

var _util2 = _interopRequireDefault(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Tracer = function () {
    function Tracer(serviceName) {
        var reporter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : new _noop_reporter2.default();
        var sampler = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new _const_sampler2.default(false);
        var logger = arguments[3];
        var tags = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

        _classCallCheck(this, Tracer);

        this._tags = tags;
        this._tags[constants.JAEGER_CLIENT_VERSION_TAG_KEY] = 'Node-' + _package2.default.version;
        this._tags[constants.TRACER_HOSTNAME_TAG_KEY] = _util2.default.myIp();

        this._serviceName = serviceName;
        this._reporter = reporter;
        this._sampler = sampler;
        this._logger = logger || new _logger2.default();
        this._injectors = {};
        this._extractors = {};

        var textCodec = new _text_map_codec2.default(false);
        this.registerInjector(opentracing.FORMAT_TEXT_MAP, textCodec);
        this.registerExtractor(opentracing.FORMAT_TEXT_MAP, textCodec);

        var httpCodec = new _text_map_codec2.default(true);
        this.registerInjector(opentracing.FORMAT_HTTP_HEADERS, httpCodec);
        this.registerExtractor(opentracing.FORMAT_HTTP_HEADERS, httpCodec);

        var binaryCodec = new _binary_codec2.default();
        this.registerInjector(opentracing.FORMAT_BINARY, binaryCodec);
        this.registerExtractor(opentracing.FORMAT_BINARY, binaryCodec);
    }

    _createClass(Tracer, [{
        key: '_startInternalSpan',
        value: function _startInternalSpan(spanContext, operationName, startTime) {
            var internalTags = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
            var tags = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
            var rpcServer = arguments[5];


            var firstInProcess = rpcServer || spanContext.parentId == null;
            var span = new _span2.default(this, operationName, spanContext, startTime, firstInProcess);

            span.addTags(tags);
            span.addTags(internalTags);
            return span;
        }
    }, {
        key: '_report',
        value: function _report(span) {
            if (span.firstInProcess) {
                span.addTags(this._tags);
            }

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

    }, {
        key: 'startSpan',
        value: function startSpan(operationName, fields) {
            // Convert fields.childOf to fields.references as needed.
            fields = fields || {};
            fields.operationName = operationName;

            var tags = fields.tags || {};
            var references = fields.references || [];
            var startTime = fields.startTime;
            if (!startTime) {
                startTime = _util2.default.getTimestampMicros();
            }

            // TODO(oibe) support use of references
            var parent = fields.childOf;
            if (!parent) {
                // If there is no childOf in fields, then search list of references
                for (var i = 0; i < references.length; i++) {
                    var ref = references[i];
                    var ref_type = ref.type();
                    if (ref_type === opentracing.REFERENCE_CHILD_OF || ref_type === opentracing.REFERENCE_FOLLOWS_FROM) {
                        parent = ref.referencedContext();
                        break;
                    } else {
                        // TODO(oibe) support other types of span references
                    }
                }
            }

            var spanKindValue = tags[_opentracing.Tags.SPAN_KIND];
            var rpcServer = spanKindValue === _opentracing.Tags.SPAN_KIND_RPC_SERVER;

            // $FlowIgnore - I just want a span context up front.
            var ctx = new _span_context2.default();
            var samplerTags = {};
            if (!parent) {
                var randomId = _util2.default.getRandom64();
                var flags = 0;
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
                    ctx.spanId = _util2.default.getRandom64();
                    ctx.parentId = parent.spanId;
                }
                ctx.flags = parent.flags;

                // reuse parent's baggage as we'll never change it
                ctx.baggage = parent.baggage;
            }

            return this._startInternalSpan(ctx, fields.operationName, startTime, samplerTags, tags, rpcServer);
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
            var injector = this._injectors[format];
            if (!injector) {
                throw new Error('Unsupported format: ' + format);
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

    }, {
        key: 'extract',
        value: function extract(format, carrier) {
            var extractor = this._extractors[format];
            if (!extractor) {
                throw new Error('Unsupported format: ' + format);
            }

            return extractor.extract(carrier);
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
         * Writes spans to the local agent, and executes a callback if necessary.
         *
         * @param {Function} [callback] - a callback that runs after spans have been flushed.
         **/

    }, {
        key: 'flush',
        value: function flush(callback) {
            this._reporter.flush(callback);
        }
    }]);

    return Tracer;
}();

exports.default = Tracer;
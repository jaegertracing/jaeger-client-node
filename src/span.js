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

import BaggageSetter from './baggage/baggage_setter';
import * as constants from './constants';
import * as opentracing from 'opentracing';
import SpanContext from './span_context';
import Tracer from './tracer';
import Utils from './util';

export default class Span {
  _tracer: Tracer;
  _operationName: string;
  _spanContext: SpanContext;
  _startTime: number;
  _logger: any;
  _duration: number;
  _logs: Array<LogData>;
  _tags: Array<Tag>;
  static _baggageHeaderCache: {};
  _references: Array<Reference>;
  _baggageSetter: BaggageSetter;

  constructor(
    tracer: Tracer,
    operationName: string,
    spanContext: SpanContext,
    startTime: number,
    references: Array<Reference>
  ) {
    this._tracer = tracer;
    this._operationName = operationName;
    this._spanContext = spanContext;
    this._startTime = startTime;
    this._logger = tracer._logger;
    this._references = references;
    this._baggageSetter = tracer._baggageSetter;
    this._logs = [];
    this._tags = [];
  }

  static _getBaggageHeaderCache() {
    if (!Span._baggageHeaderCache) {
      Span._baggageHeaderCache = {};
    }

    return Span._baggageHeaderCache;
  }

  /**
   * Returns a normalize key.
   *
   * @param {string} key - The key to be normalized for a particular baggage value.
   * @return {string} - The normalized key (lower cased and underscores replaced, along with dashes.)
   **/
  _normalizeBaggageKey(key: string) {
    let baggageHeaderCache = Span._getBaggageHeaderCache();
    if (key in baggageHeaderCache) {
      return baggageHeaderCache[key];
    }

    let normalizedKey: string = key.replace(/_/g, '-').toLowerCase();

    if (Object.keys(baggageHeaderCache).length < 100) {
      baggageHeaderCache[key] = normalizedKey;
    }

    return normalizedKey;
  }

  get operationName(): string {
    return this._operationName;
  }

  get serviceName(): string {
    return this._tracer._serviceName;
  }

  _isLocalRootSpan() {
    return this._spanContext._isLocalRootSpan();
  }

  /**
   * Sets a baggage value with an associated key.
   *
   * @param {string} key - The baggage key.
   * @param {string} value - The baggage value.
   *
   * @return {Span} - returns this span.
   **/
  setBaggageItem(key: string, value: string): Span {
    let normalizedKey = this._normalizeBaggageKey(key);

    // We create a new instance of the context here instead of just adding
    // another entry to the baggage dictionary. By doing so we keep the
    // baggage immutable so that it can be passed to children spans as is.
    // If it was mutable, we would have to make a copy of the dictionary
    // for every child span, which on average we expect to occur more
    // frequently than items being added to the baggage.
    this._spanContext = this._baggageSetter.setBaggage(this, normalizedKey, value);
    return this;
  }

  /**
   * Gets a baggage value with an associated key.
   *
   * @param {string} key - The baggage key.
   * @return {string} value - The baggage value.
   **/
  getBaggageItem(key: string): string {
    let normalizedKey = this._normalizeBaggageKey(key);
    return this._spanContext.baggage[normalizedKey];
  }

  /**
   * Returns the span context that represents this span.
   *
   * @return {SpanContext} - Returns this span's span context.
   **/
  context(): SpanContext {
    return this._spanContext;
  }

  /**
   *  Returns the tracer associated with this span.
   *
   * @return {Tracer} - returns the tracer associated with this span.
   **/
  tracer(): Tracer {
    return this._tracer;
  }

  /**
   * Checks whether or not a span can be written to.
   *
   * @return {boolean} - The decision about whether this span can be written to.
   **/
  _isWriteable(): boolean {
    return !this._spanContext.samplingFinalized || this._spanContext.isSampled();
  }

  /**
   * Sets the operation name on this given span.
   *
   * @param {string} name - The name to use for setting a span's operation name.
   * @return {Span} - returns this span.
   **/
  setOperationName(operationName: string): Span {
    this._operationName = operationName;
    // We re-sample the span if it has not been finalized.
    if (!this._spanContext.samplingFinalized) {
      this._tracer._sampler.onSetOperationName(this, operationName);
    }
    return this;
  }

  /**
   * Sets the end timestamp and finalizes Span state.
   *
   * With the exception of calls to Span.context() (which are always allowed),
   * finish() must be the last call made to any span instance, and to do
   * otherwise leads to undefined behavior.
   *
   * @param  {number} finishTime
   *         Optional finish time in milliseconds as a Unix timestamp. Decimal
   *         values are supported for timestamps with sub-millisecond accuracy.
   *         If not specified, the current time (as defined by the
   *         implementation) will be used.
   */
  finish(finishTime: ?number): void {
    if (this._duration !== undefined) {
      let spanInfo = `operation=${this.operationName},context=${this.context().toString()}`;
      this.tracer()._logger.error(`${spanInfo}#You can only call finish() on a span once.`);
      return;
    }

    this._spanContext.finalizeSampling();
    if (this._spanContext.isSampled()) {
      let endTime = finishTime || this._tracer.now();
      this._duration = endTime - this._startTime;
      this._tracer._report(this);
    }
  }

  /**
   * Adds a set of tags to a span.
   *
   * @param {Object} keyValuePairs - An object with key value pairs
   * that represent tags to be added to this span.
   * @return {Span} - returns this span.
   **/
  addTags(keyValuePairs: any): Span {
    const hasOwnProperty = Object.prototype.hasOwnProperty;
    const sampler = this._tracer._sampler;
    const samplingKey = opentracing.Tags.SAMPLING_PRIORITY;
    const samplingPriority = keyValuePairs[samplingKey];
    const samplingWasSet = samplingPriority != null && this._setSamplingPriority(samplingPriority);
    if (this._isWriteable()) {
      // if we updated the sampling priority, add the tag straight-away
      if (samplingWasSet) {
        this._setTag(samplingKey, samplingPriority);
        sampler.onSetTag(this, samplingKey, samplingPriority);
      }
      for (let key in keyValuePairs) {
        if (hasOwnProperty.call(keyValuePairs, key)) {
          if (key === samplingKey) {
            // this has already been added, if it was updated
            continue;
          }
          const value = keyValuePairs[key];
          this._setTag(key, value);
          sampler.onSetTag(this, key, value);
        }
      }
    }
    return this;
  }

  /**
   * Adds a single tag to a span
   *
   * @param {string} key - The key for the tag added to this span.
   * @param {string} value - The value corresponding with the key
   * for the tag added to this span.
   * @return {Span} - returns this span.
   * */
  setTag(key: string, value: any): Span {
    if (key === opentracing.Tags.SAMPLING_PRIORITY && !this._setSamplingPriority(value)) {
      return this;
    }

    if (this._isWriteable()) {
      this._setTag(key, value);
      this._tracer._sampler.onSetTag(this, key, value);
    }
    return this;
  }

  /**
   * Adds a log event, or payload to a span.
   *
   * @param {object} keyValuePairs
   *        An object mapping string keys to arbitrary value types. All
   *        Tracer implementations should support bool, string, and numeric
   *        value types, and some may also support Object values.
   * @param {number} timestamp
   *        An optional parameter specifying the timestamp in milliseconds
   *        since the Unix epoch. Fractional values are allowed so that
   *        timestamps with sub-millisecond accuracy can be represented. If
   *        not specified, the implementation is expected to use its notion
   *        of the current time of the call.
   * @return {Span} - returns this span.
   */
  log(keyValuePairs: any, timestamp: ?number): Span {
    if (this._isWriteable()) {
      this._logs.push({
        timestamp: timestamp || this._tracer.now(),
        fields: Utils.convertObjectToTags(keyValuePairs),
      });
    }
    return this;
  }

  /**
   * Logs a event with an optional payload.
   *
   * @param  {string} eventName - string associated with the log record
   * @param  {object} [payload] - arbitrary payload object associated with the
   *         log record.
   */
  logEvent(eventName: string, payload: any): void {
    this.log({
      event: eventName,
      payload: payload,
    });
  }

  /**
   * Returns true if the flag was updated successfully, false otherwise
   *
   * @param priority - 0 to disable sampling, 1 to enable
   * @returns {boolean} - true if the flag was updated successfully
   * @private
   */
  _setSamplingPriority(priority: number): boolean {
    this._spanContext.finalizeSampling();
    if (priority > 0) {
      if (this._spanContext.isDebug()) {
        // If the span is already in debug, no need to set it again
        return false;
      }
      if (this._tracer._isDebugAllowed(this._operationName)) {
        this._spanContext._setIsSampled(true);
        this._spanContext._setIsDebug(true);
        return true;
      }
      return false;
    }
    this._spanContext._setIsSampled(false);
    this._spanContext._setIsDebug(false);
    return true;
  }

  _setTag(key: string, value: any): void {
    this._tags.push({ key: key, value: value });
  }
}

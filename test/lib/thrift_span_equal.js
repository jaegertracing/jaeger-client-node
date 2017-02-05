import deepEqual from 'deep-equal';

export default function thriftSpanEqual(spanOne, spanTwo) {
    return  deepEqual(spanOne.traceIdLow, spanTwo.traceIdLow) &&
            deepEqual(spanOne.traceIdHigh, spanTwo.traceIdHigh) &&
            deepEqual(spanOne.spanId, spanTwo.spanId) &&
            deepEqual(spanOne.parentSpanId, spanTwo.parentSpanId) &&
            spanOne.operationName === spanTwo.operationName &&
            deepEqual(spanOne.references, spanTwo.references) &&
            spanOne.flags === spanTwo.flags &&
            deepEqual(spanOne.startTime, spanTwo.startTime) &&
            deepEqual(spanOne.duration, spanTwo.duration);
}

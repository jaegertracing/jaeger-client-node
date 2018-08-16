// Copyright (c) 2018 Uber Technologies, Inc.
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

import _ from 'lodash';
import express from 'express';
import * as URL from 'url';
import { raw } from 'body-parser';
import { assert, expect } from 'chai';
import ConstSampler from '../src/samplers/const_sampler.js';
import https from 'https';
import fs from 'fs';
import path from 'path';
import semver from 'semver';
import InMemoryReporter from '../src/reporters/in_memory_reporter.js';
import RemoteReporter from '../src/reporters/remote_reporter.js';
import opentracing from 'opentracing';
import Tracer from '../src/tracer.js';
import { Thrift } from 'thriftrw';
import ThriftUtils from '../src/thrift.js';
import HTTPSender from '../src/reporters/http_sender.js';

const batchSize = 100;

describe('http sender', () => {
  let app;
  let server;
  let tracer;
  let thrift;
  let serverEndpoint;
  let reporter;
  let sender;

  function assertThriftSpanEqual(assert, spanOne, spanTwo) {
    assert.deepEqual(spanOne.traceIdLow, spanTwo.traceIdLow);
    assert.deepEqual(spanOne.traceIdHigh, spanTwo.traceIdHigh);
    assert.deepEqual(spanOne.spanId, spanTwo.spanId);
    assert.deepEqual(spanOne.parentSpanId, spanTwo.parentSpanId);
    assert.equal(spanOne.operationName, spanTwo.operationName);
    assert.deepEqual(spanOne.references, spanTwo.references);
    assert.equal(spanOne.flags, spanTwo.flags);
    assert.deepEqual(spanOne.startTime, spanTwo.startTime);
    assert.deepEqual(spanOne.duration, spanTwo.duration);
  }

  beforeEach(() => {
    thrift = new Thrift({
      source: fs.readFileSync(path.join(__dirname, '../src/jaeger-idl/thrift/jaeger.thrift'), 'ascii'),
      allowOptionalArguments: true,
    });

    app = express();
    app.use(raw({ type: 'application/x-thrift' }));
    app.post('/api/traces', (req, res) => {
      if (req.headers.authorization) {
        const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
        const [username, password] = new Buffer(b64auth, 'base64').toString().split(':');
        server.emit('authReceived', [username, password]);
      }
      let thriftObj = thrift.Batch.rw.readFrom(req.body, 0);
      let batch = thriftObj.value;
      if (batch) {
        server.emit('batchReceived', batch);
      }
      res.status(202).send('');
    });
    server = app.listen(0);
    serverEndpoint = `http://localhost:${server.address().port}/api/traces`;

    reporter = new InMemoryReporter();
    tracer = new Tracer('test-service-name', reporter, new ConstSampler(true));
    sender = new HTTPSender({
      endpoint: serverEndpoint,
      maxSpanBatchSize: batchSize,
    });
    sender.setProcess(reporter._process);
  });

  afterEach(() => {
    tracer.close();
    server.close();
  });

  function assertCallback(expectedNumSpans, expectedError): SenderCallback {
    return (numSpans, error) => {
      assert.equal(numSpans, expectedNumSpans);
      assert.equal(error, expectedError);
    };
  }

  it('should read and verify spans and process sent', done => {
    let spanOne = tracer.startSpan('operation-one');
    spanOne.finish(); // finish to set span duration
    spanOne = ThriftUtils.spanToThrift(spanOne);
    let spanTwo = tracer.startSpan('operation-two');
    spanTwo.finish(); // finish to set span duration
    spanTwo = ThriftUtils.spanToThrift(spanTwo);

    server.on('batchReceived', batch => {
      assert.isOk(batch);
      assert.equal(batch.spans.length, 2);

      assertThriftSpanEqual(assert, spanOne, batch.spans[0]);
      assertThriftSpanEqual(assert, spanTwo, batch.spans[1]);

      assert.equal(batch.process.serviceName, 'test-service-name');
      let actualTags = _.sortBy(batch.process.tags, o => {
        return o.key;
      });
      assert.equal(actualTags.length, 4);
      assert.equal(actualTags[0].key, 'client-uuid');
      assert.equal(actualTags[1].key, 'ip');
      assert.equal(actualTags[2].key, 'jaeger.hostname');
      assert.equal(actualTags[3].key, 'jaeger.version');
    });

    sender.append(spanOne, assertCallback(0, undefined));
    sender.append(spanTwo, assertCallback(0, undefined));
    sender.flush((numSpans, error) => {
      assertCallback(2, undefined)(numSpans, error);
      done();
    });
  });

  describe('span reference tests', () => {
    let tracer = new Tracer('test-service-name', new InMemoryReporter(), new ConstSampler(true));
    let parentContext = tracer.startSpan('just-used-for-context').context();
    let childOfContext = tracer.startSpan('just-used-for-context').context();
    let childOfRef = new opentracing.Reference(opentracing.REFERENCE_CHILD_OF, childOfContext);
    let followsFromContext = tracer.startSpan('just-used-for-context').context();
    let followsFromRef = new opentracing.Reference(opentracing.REFERENCE_FOLLOWS_FROM, followsFromContext);

    let options = [
      { childOf: null, references: [], expectedTraceId: null, expectedParentId: null },
      {
        childOf: parentContext,
        references: [childOfRef, followsFromRef],
        expectedTraceId: parentContext.traceId,
        expectedParentId: parentContext.parentId,
      },
    ];

    _.each(options, o => {
      it('should serialize span references', done => {
        const span = tracer.startSpan('bender', {
          childOf: o.childOf,
          references: o.references,
        });
        span.finish();
        const tSpan = ThriftUtils.spanToThrift(span);

        server.on('batchReceived', function(batch) {
          assert.isOk(batch);
          assertThriftSpanEqual(assert, tSpan, batch.spans[0]);

          if (o.expectedTraceId) {
            assert.deepEqual(batch.spans[0].traceIdLow, o.expectedTraceId);
          }

          if (o.expectedParentId) {
            assert.deepEqual(batch.spans[0].parentId, o.expectedParentId);
          } else {
            assert.isNotOk(batch.spans[0].parentId);
          }

          done();
        });

        sender.append(tSpan);
        sender.flush();
      });
    });
  });

  it('should flush spans when capacity is reached', done => {
    const spans = [];
    for (let i = 0; i < batchSize; i++) {
      let s = tracer.startSpan(`operation-${i}`);
      s.finish();
      spans.push(ThriftUtils.spanToThrift(s));
    }

    for (let i = 0; i < batchSize - 1; i++) {
      sender.append(spans[i], assertCallback(0, undefined));
    }

    sender.append(spans[batchSize - 1], assertCallback(batchSize, undefined));

    server.on('batchReceived', batch => {
      done();
    });
  });

  it('should use basic auth if username/password provided', done => {
    sender = new HTTPSender({
      endpoint: serverEndpoint,
      username: 'me',
      password: 's3cr3t',
      maxSpanBatchSize: batchSize,
    });
    sender.setProcess(reporter._process);

    const s = tracer.startSpan('operation-one');
    s.finish();
    sender.append(ThriftUtils.spanToThrift(s), assertCallback(0, undefined));
    sender.flush();

    server.on('authReceived', creds => {
      expect(creds[0]).to.equal('me');
      expect(creds[1]).to.equal('s3cr3t');
      done();
    });
  });

  it('should returns error from flush() on failed buffer conversion', done => {
    let span = tracer.startSpan('leela');
    span.finish(); // finish to set span duration
    span = ThriftUtils.spanToThrift(span);
    span.flags = 'string'; // malform the span to create a serialization error

    sender.append(span);
    sender.flush((numSpans, err) => {
      assert.equal(numSpans, 1);
      expect(err).to.have.string('Error encoding Thrift batch:');
      done();
    });
  });

  it('should return 0,undefined on flush() with no spans', () => {
    sender.flush(assertCallback(0, undefined));
  });

  it('should gracefully handle errors emitted by socket.send', done => {
    sender = new HTTPSender({
      endpoint: 'http://foo.bar.xyz',
      maxSpanBatchSize: batchSize,
    });
    sender.setProcess(reporter._process);

    let tracer = new Tracer('test-service-name', new RemoteReporter(sender), new ConstSampler(true));

    tracer.startSpan('testSpan').finish();
    sender.flush((numSpans, err) => {
      assert.equal(numSpans, 1);
      expect(err).to.have.string('error sending spans over HTTP: Error: getaddrinfo ENOTFOUND');
      tracer.close(done);
    });
  });

  it('should handle HTTPS collectors', done => {
    // Make it ignore the fact that our cert isn't valid.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    var options = {
      key:
        '-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDmnEKeVkNNQylt\nI+HgcxBzY3w9oCMvg/SBn0jy5d9XYeQNreP+VujBNEo+OmmAzYeh7Nv3lq78zH31\nRzznwF/4lYBE148SOhT+KP0NvAt4uiVf3zjD2zChSdpSWoR9CZOxwJM06YrIvJlX\nxkm3fcWzcZ6r/DrhDgC44QXlD1qqcFZ5ITkGRWF+ym5sh+FRr1qhRcFURFMH67G2\niZ+CLUzBPAYJ8Ho9HNkm8R0IN/yLAymnjXLW7QjrZ+w88IVyv38Lm9RFFjQ21WRq\nSdCMw0/ZL+Fcmjstj3PvcO5jPFNwijuKMvkpP1fspH9wLNg6NzChkwTNUlqsekek\nOlvihWRvAgMBAAECggEAUZcJjuGwUB6qAn5GhVXQhTK2m0sUB9Sk5lOHyMCBw3XT\n7O8QEkWHdgvdFKUv/K07BpQ5wyBh6vkiu2wn5UrP6bBjQHgPm4BHOyEfXwOf/2fE\nn2XnvIvJadcqUibKZz7DLYmXy4mxW5I2orJ6FFyAXRue6vSDlGqS4NZkcoV7K3+F\nWtBDGl1FVEqQXy1iCmbm0izqlFAf3xV1piS+hd0XgM1+3F8mcmICP+oWDJLeItXO\nEjklysZdcZ6o40Vr7Sxp2XhC/BO7r6MsYCP1PDPl6fQnkIS7mf1qjHZo+ryRVhB4\nRY1SSGT5xRc4v2pBcxSwELEJRiJMj/WcrveneGJZeQKBgQD8Wro1S50Dis8Qf9+o\nYU+jSsRwJmoAguZNNOXXdovN7LMOqykOXl13vXZ+gth6R2UlbU7EVNLe+dAxnHKv\njBPEvQPm3dh4V9O4NNqJ5pfi85MjIc9PIZV5h7pQo77RMPv0o4Fe36Yo0fb1KD0o\nh5SCTD7F42qyQ1YqTVZDlskVNQKBgQDp8R4oegKsCZnIOhO2Q5O3Gu6+b18VmEtf\nDoOtyLTg+M27Ngnur2OdUc3YHOVpzSEi9BFkhonv6gSEplycq7LnaNBXFLF0KGrh\nC8ChaaSpY/BZLZLeBGQu9cYq6ZI+CwbClBeLAqXvJRbes7RHKTjG+6Ixea5krGB3\ng2GUDN87kwKBgQCbO0w0IJEzbp21LpPsRf/xGLsBqf+m1N7KO3HvOnMBd0smCM+2\nkQG5+If9houXnHdxsG21g+A7XTxeaDh8GBTI/uR5jZntXUlVlN2h2oEwEFlAUTnv\nGV+TZJSNqkxk7lbuw+1+6OCTV6UsZVZJqi0GgdRTcnNduOI2H2CjLwv+yQKBgQCU\nPEOm1EETL/YwyJQq/sD/2mIDa2Ctt1WzAuhvWuk6UI1UHhbHFn2hdu9fDFhV5TQl\nCNBoiVOoIPoB78RpRebT+TdipmsXNnEa7q592QoMh5YJe/Y/FjtBAl0yXdRb2fLL\norkUTXZFhZPrQ6VtHfKrK1GH1hmqEwwBTs+q10kwXwKBgQDXfm6ee3Vc7p6s7x+h\n4kf0VBZYqVVUC2N7l8BdHXc/AOAb5aRCdg0UHdA5zMghtGmk5pvburrXxNR6rJHo\nVNbvxeM87eQSDZUT8oO30kcKJKr3rHvDxN0NGghFEdvDNDIo4BFBUjwYATudRQDM\n3AahfvL8vW4xXANRuPmVz43TBA==\n-----END PRIVATE KEY-----',
      cert:
        '-----BEGIN CERTIFICATE-----\nMIIDpTCCAo2gAwIBAgIJAOOgmfOEDemYMA0GCSqGSIb3DQEBCwUAMGkxCzAJBgNV\nBAYTAlVTMQswCQYDVQQIDAJDQTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzEPMA0G\nA1UECgwGSmFlZ2VyMRAwDgYDVQQLDAdUcmFjaW5nMRIwEAYDVQQDDAlsb2NhbGhv\nc3QwHhcNMTgwODE2MTg0MjA0WhcNNDYwMTAxMTg0MjA0WjBpMQswCQYDVQQGEwJV\nUzELMAkGA1UECAwCQ0ExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xDzANBgNVBAoM\nBkphZWdlcjEQMA4GA1UECwwHVHJhY2luZzESMBAGA1UEAwwJbG9jYWxob3N0MIIB\nIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5pxCnlZDTUMpbSPh4HMQc2N8\nPaAjL4P0gZ9I8uXfV2HkDa3j/lbowTRKPjppgM2Hoezb95au/Mx99Uc858Bf+JWA\nRNePEjoU/ij9DbwLeLolX984w9swoUnaUlqEfQmTscCTNOmKyLyZV8ZJt33Fs3Ge\nq/w64Q4AuOEF5Q9aqnBWeSE5BkVhfspubIfhUa9aoUXBVERTB+uxtomfgi1MwTwG\nCfB6PRzZJvEdCDf8iwMpp41y1u0I62fsPPCFcr9/C5vURRY0NtVkaknQjMNP2S/h\nXJo7LY9z73DuYzxTcIo7ijL5KT9X7KR/cCzYOjcwoZMEzVJarHpHpDpb4oVkbwID\nAQABo1AwTjAdBgNVHQ4EFgQUz2dnzTaJoc995597JxRu5jQRno0wHwYDVR0jBBgw\nFoAUz2dnzTaJoc995597JxRu5jQRno0wDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0B\nAQsFAAOCAQEAPTpTJnhIwtbxa/yDn7BvkV6DDU/Y+fyXuR/wEb/aFfsWfJbK+7qe\nFChX4hxiAOMUEEGhyredunCG3cgz46l+Lb+vQZafzr0JZCBNa6IKRUVWkHps2TRV\nwtcXSFAly4tcRyYGtVr+qGFd9oHWBRSBU0bzv3Rb/AVbXCpSTcjZwqPRvzqyICYf\nkZ7z6b0kLxSume4h6beQnCH/tWdxbZqZbsEINxO5o6JHhslpiGNjm5BulT6dr91k\n8O6L8TprggQz6H5l8N5dCxbYARTsHBf1tqcmyxV/hAjoJFU9kvmU+r+QJMRWCyOe\nCk6tc1MJHquCkX3Xum+KKegTn18rot6XvQ==\n-----END CERTIFICATE-----',
    };

    server = https.createServer(options, app).listen(0);
    serverEndpoint = `https://localhost:${server.address().port}/api/traces`;
    sender = new HTTPSender({
      endpoint: serverEndpoint,
      maxSpanBatchSize: batchSize,
    });
    sender.setProcess(reporter._process);

    const s = tracer.startSpan('operation');
    s.finish();
    sender.append(ThriftUtils.spanToThrift(s));
    sender.flush();

    server.on('batchReceived', batch => {
      done();
    });
  });
});

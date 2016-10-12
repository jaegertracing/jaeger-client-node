[![Build Status][ci-img]][ci] [![Coverage Status][cov-img]][cov]

# Jaeger Bindings for Javascript OpenTracing API

This is a client side library that implements
[Javascript OpenTracing API](https://github.com/opentracing/opentracing-javascript/),
with Zipkin-compatible data model.

**This project is currently WIP and not ready for use. Do not use it until this notice goes away.**

## Developing

 1. `git submodule update --init`
 2. `npm install`
 3. `npm test`
 4. `make build-node`

  [ci-img]: https://travis-ci.org/uber/jaeger-client-node.svg?branch=master
  [cov-img]: https://coveralls.io/repos/github/uber/jaeger-client-node/badge.svg?branch=master
  [ci]: https://travis-ci.org/uber/jaeger-client-node
  [cov]: https://coveralls.io/github/uber/jaeger-client-node?branch=master

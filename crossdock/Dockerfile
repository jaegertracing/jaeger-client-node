FROM node:14-alpine

# tchannel uses node-gyp to compile native libs, which requires python.
RUN apk update && apk add python g++ make bash && rm -rf /var/cache/apk/*

EXPOSE 8080-8082

ADD package.json /
ADD package-lock.json /
ADD src/ /src
ADD src/jaeger-idl/thrift/crossdock/tracetest.thrift /crossdock/tracetest.thrift
ADD crossdock/src/ /crossdock/src
ADD .babelrc /

RUN npm install

CMD ["/bin/bash", "/crossdock/src/driver.sh"]

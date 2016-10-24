FROM woorank/docker-node-babel
EXPOSE 8080-8082

ADD node_modules/ /node_modules
ADD package.json /
ADD src/ /src
ADD src/jaeger-idl/thrift/crossdock/tracetest.thrift /crossdock/tracetest.thrift
ADD crossdock/src /crossdock/src
ADD .babelrc /

# I only add tchannel because tchanel is the only depenency that requires native code compilation.
# Doing a full npm install would make this build really slow
RUN npm install tchannel

CMD ["/crossdock/src/driver.sh"]

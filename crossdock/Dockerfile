# 2020-07-16: the source image used to be woorank/docker-node-babel.
#   However, it is no longer available from Docker Hub.
#   It was republished from a local cache as jaegertracing/xdock-node:docker-node-babel.
#     woorank/docker-node-babel                                        latest              1fef8ea9e76f        4 years ago         778MB
#     jaegertracing/xdock-node                                         docker-node-babel   1fef8ea9e76f        4 years ago         778MB

FROM jaegertracing/xdock-node:docker-node-babel

EXPOSE 8080-8082

ADD node_modules/ /node_modules
ADD package.json /
ADD src/ /src
ADD src/jaeger-idl/thrift/crossdock/tracetest.thrift /crossdock/tracetest.thrift
ADD crossdock/src /crossdock/src
ADD .babelrc /

# We re-install tchannel because it is the only depenency that requires native code compilation.
# Doing a full npm install inside the container would make this build really slow.
# We pin tchannel to v3, because v4 removed support for Node-v0.10.
RUN npm install tchannel@3.9.13
RUN npm ls

CMD ["/crossdock/src/driver.sh"]

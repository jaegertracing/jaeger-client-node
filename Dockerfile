FROM woorank/docker-node-babel
EXPOSE 8080-8082

ADD node_modules/ /node_modules
ADD package.json /
ADD src/ /src
ADD crossdock/src /crossdock/src
ADD .babelrc /

RUN npm install tchannel

CMD ["/crossdock/src/driver.sh"]

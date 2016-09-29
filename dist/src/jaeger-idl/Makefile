
THRIFT_VER=0.9.2
THRIFT_IMG=thrift:$(THRIFT_VER)
THRIFT=docker run -v "${PWD}:/data" $(THRIFT_IMG) thrift
THRIFT_GO_ARGS=thrift_import="github.com/apache/thrift/lib/go/thrift"

test_ci:	thrift

thrift:	thrift-image
	$(THRIFT) -o /data --gen go:$(THRIFT_GO_ARGS) /data/thrift/agent.thrift
	$(THRIFT) -o /data --gen go:$(THRIFT_GO_ARGS) /data/thrift/jaeger.thrift
	$(THRIFT) -o /data --gen go:$(THRIFT_GO_ARGS) /data/thrift/sampling.thrift
	$(THRIFT) -o /data --gen go:$(THRIFT_GO_ARGS) /data/thrift/zipkincore.thrift
	$(THRIFT) -o /data --gen go:$(THRIFT_GO_ARGS) /data/thrift/crossdock/tracetest.thrift

thrift-image:
	docker pull $(THRIFT_IMG)
	$(THRIFT) -version


PROJECT=crossdock
JAEGER_COMPOSE_URL=https://raw.githubusercontent.com/jaegertracing/jaeger/master/docker-compose/jaeger-docker-compose.yml
XDOCK_JAEGER_YAML=$(PROJECT)/jaeger-docker-compose.yml
XDOCK_YAML=$(PROJECT)/docker-compose.yml

.PHONY: crossdock
crossdock: install_node_modules crossdock-download-jaeger
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) kill node
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) rm -f node
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) build node
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) run crossdock

.PHONY: crossdock-fresh
crossdock-fresh: install_node_modules crossdock-download-jaeger
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) kill
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) rm --force
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) pull
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) build --no-cache
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) run crossdock

.PHONY: crossdock-logs
crossdock-logs: crossdock-download-jaeger
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) logs

.PHONY: install_node_modules
install_node_modules:
	npm install
	npm uninstall tchannel

.PHONY: install_docker_ci
install_docker_ci:
	@echo "Installing docker-compose $${DOCKER_COMPOSE_VERSION:?'DOCKER_COMPOSE_VERSION env not set'}"
	sudo rm -f /usr/local/bin/docker-compose
	curl -L https://github.com/docker/compose/releases/download/$${DOCKER_COMPOSE_VERSION}/docker-compose-`uname -s`-`uname -m` > docker-compose
	chmod +x docker-compose
	sudo mv docker-compose /usr/local/bin
	docker-compose version

.PHONY: crossdock-download-jaeger
crossdock-download-jaeger:
	curl -o $(XDOCK_JAEGER_YAML) $(JAEGER_COMPOSE_URL)

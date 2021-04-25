PROJECT=crossdock
XDOCK_YAML=$(PROJECT)/docker-compose.yml

.PHONY: crossdock
crossdock: install_node_modules crossdock-kill
	docker-compose -f $(XDOCK_YAML) rm -f node
	docker-compose -f $(XDOCK_YAML) build node
	docker-compose -f $(XDOCK_YAML) run crossdock

.PHONY: crossdock-fresh
crossdock-fresh: install_node_modules crossdock-kill
	docker-compose -f $(XDOCK_YAML) rm --force
	docker-compose -f $(XDOCK_YAML) pull
	docker-compose -f $(XDOCK_YAML) build --no-cache
	docker-compose -f $(XDOCK_YAML) run crossdock

.PHONY: crossdock-logs
crossdock-logs:
	docker-compose -f $(XDOCK_YAML) logs

.PHONY: crossdock-kill
crossdock-kill:
	docker-compose -f $(XDOCK_YAML) kill

.PHONY: install_node_modules
install_node_modules:
	echo skipping npm install
	echo skipping npm uninstall tchannel

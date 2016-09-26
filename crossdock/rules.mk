PROJECT=crossdock
XDOCK_YAML=$(PROJECT)/docker-compose.yml

.PHONY: crossdock
crossdock:
	docker-compose -f $(XDOCK_YAML) kill node
	docker-compose -f $(XDOCK_YAML) rm -f node
	docker-compose -f $(XDOCK_YAML) build node
	docker-compose -f $(XDOCK_YAML) run crossdock

.PHONY: crossdock-fresh
crossdock-fresh:
	docker-compose -f $(XDOCK_YAML) kill
	docker-compose -f $(XDOCK_YAML) rm --force
	docker-compose -f $(XDOCK_YAML) pull
	docker-compose -f $(XDOCK_YAML) build --no-cache
	docker-compose -f $(XDOCK_YAML) run crossdock

.PHONY: crossdock-logs
crossdock-logs:
	docker-compose -f $(XDOCK_YAML) logs

#foo.bak: foo.bar
#	    echo "foo"
#		    if [ -d "~/Dropbox" ]; then \
#				        echo "Dir exists"; \
#						    fi

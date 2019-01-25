-include crossdock/rules.mk

NODE_VER=$(shell node -v)
ifeq ($(patsubst v8.%,matched,$(NODE_VER)), matched)
	NODE_8=true
else
	NODE_8=false
endif
ifeq ($(patsubst v0.10%,matched,$(NODE_VER)), matched)
	NODE_0_10=true
else
	NODE_0_10=false
endif

.PHONY: publish
publish: build-node
	npm version $(shell ./scripts/version_prompt.sh)
	# Make a pull request for this version.
	# Follow internal instructions to publish npm through uber account.
	# Update Changelog.md to relfect the newest version changes.

.PHONY: test
test: build-node
	make test-without-build

.PHONY: test-without-build
test-without-build: install-test-deps
	yarn flow
ifeq ($(NODE_8),true)
	yarn test-all
endif
	yarn test-dist
	yarn check-license

.PHONY: install-test-deps
install-test-deps:
ifeq ($(NODE_0_10), false)
	yarn add prom-client@11.0.0
endif

.PHONY: check-node-8
check-node-8:
	@$(NODE_8) || echo Build requires Node 8.x
	@$(NODE_8) && echo Building using Node 8.x

.PHONY: build-node
build-node: check-node-8 node-modules
	rm -rf ./dist/
	node_modules/.bin/babel --presets env --plugins transform-class-properties --source-maps -d dist/src/ src/
	node_modules/.bin/babel --presets env --plugins transform-class-properties --source-maps -d dist/test/ test/
	node_modules/.bin/babel --presets env --plugins transform-class-properties --source-maps -d dist/crossdock/ crossdock/
	cp -R ./test/thrift ./dist/test/thrift/
	cp -R ./src/jaeger-idl ./dist/src/
	rm -rf ./dist/src/jaeger-idl/.git
	cp -R ./src/thriftrw-idl ./dist/src/

.PHONY: node-modules
node-modules:
	git submodule init -- ./src/jaeger-idl
	git submodule update
	yarn

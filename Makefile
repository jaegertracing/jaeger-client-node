-include crossdock/rules.mk

NODE_VER=$(shell node -v)
ifeq ($(patsubst v6.%,v6,$(NODE_VER)), v6)
	NODE_6=true
else
	NODE_6=false
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
test-without-build:
	npm run flow
ifeq ($(NODE_6),true)
	npm run test-all
endif
	npm run test-dist
	npm run check-license

.PHONY: check-node-6
check-node-6:
	@$(NODE_6) || echo Build requires Node 6.x
	@$(NODE_6) && echo Building using Node 6.x

.PHONY: build-node
build-node: check-node-6 node-modules
	rm -rf ./dist/
	node_modules/.bin/babel --presets env --plugins transform-class-properties --source-maps -d dist/src/ src/
	node_modules/.bin/babel --presets env --plugins transform-class-properties --source-maps -d dist/test/ test/
	node_modules/.bin/babel --presets env --plugins transform-class-properties --source-maps -d dist/crossdock/ crossdock/
	cp -R ./test/thrift ./dist/test/thrift/
	cp package.json ./dist/
	cp -R ./src/jaeger-idl ./dist/src/
	rm -rf ./dist/src/jaeger-idl/.git
	cp -R ./src/thriftrw-idl ./dist/src/

.PHONY: node-modules
node-modules:
	git submodule init -- ./src/jaeger-idl
	git submodule update
	npm install

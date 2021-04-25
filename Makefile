-include crossdock/rules.mk

LTS_NODE_VER=14
NODE_VER=$(shell node -v)
ifeq ($(patsubst v$(LTS_NODE_VER).%,matched,$(NODE_VER)), matched)
	NODE_LTS=true
else
	NODE_LTS=false
endif

.PHONY: publish
publish: build-node
	npm version $(shell ./scripts/version_prompt.sh)
	# Make a pull request for this version.
	# Follow internal instructions to publish npm through uber account.
	# Update Changelog.md to relfect the newest version changes.

.PHONY: test
test: build-node test-without-build

.PHONY: test-without-build
test-without-build:
	npm run flow
ifeq ($(NODE_LTS),true)
	npm run test-all
endif
	npm run test-dist
	npm run check-license

.PHONY: check-node-lts
check-node-lts:
	@$(NODE_LTS) || echo Build requires Node v$(LTS_NODE_VER)
	@$(NODE_LTS) && echo Building using Node v$(LTS_NODE_VER)

.PHONY: build-node
build-node: check-node-lts node-modules build-without-install

.PHONY: build-without-install
build-without-install:
	rm -rf ./dist/
	node_modules/.bin/babel --presets env --plugins transform-class-properties --source-maps -d dist/src/ src/
	node_modules/.bin/babel --presets env --plugins transform-class-properties --source-maps -d dist/test/ test/
	node_modules/.bin/babel --presets env --plugins transform-class-properties --source-maps -d dist/crossdock/ crossdock/
	cat src/version.js | sed "s|VERSION_TBD|$(shell node -p 'require("./package.json").version')|g" > dist/src/version.js
	cp -R ./test/thrift ./dist/test/thrift/
	cp -R ./src/jaeger-idl ./dist/src/
	rm -rf ./dist/src/jaeger-idl/.git
	cp -R ./src/thriftrw-idl ./dist/src/

.PHONY: node-modules
node-modules:
	git submodule init -- ./src/jaeger-idl
	git submodule update
	npm install

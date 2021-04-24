-include crossdock/rules.mk

NODE_VER=$(shell node -v)
ifeq ($(patsubst v14.%,matched,$(NODE_VER)), matched)
	NODE_LTS=true
else
	NODE_LTS=false
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
	npm run flow
ifeq ($(NODE_LTS),true)
	npm run test-all
endif
	npm run test-dist
	npm run check-license

.PHONY: test-without-install
test-without-install: build-without-install
	npm run flow
ifeq ($(NODE_LTS),true)
	npm run test-all
endif
	npm run test-dist
	npm run check-license

.PHONY: install-test-deps
install-test-deps:
ifeq ($(NODE_0_10), false)
	npm install --no-save prom-client@11.0.0
endif

.PHONY: check-node-lts
check-node-lts:
	@$(NODE_LTS) || echo Build requires Node 10.x
	@$(NODE_LTS) && echo Building using Node 10.x

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

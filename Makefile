-include crossdock/rules.mk

.PHONY: publish
publish: build-node
	npm version $(shell ./scripts/version_prompt.sh)
	# Make a pull request for this version.
	# Follow internal instructions to publish npm through uber account.
	# Update Changelog.md to relfect the newest version changes.

.PHONY: test
test: build-node
	npm run flow
	npm run lint
	npm run test-all
	npm run check-license

.PHONY: build-node
build-node: node_modules
	rm -rf ./dist/
	node_modules/.bin/babel --presets es2015 --plugins transform-class-properties --source-maps -d dist/src/ src/
	node_modules/.bin/babel --presets es2015 --plugins transform-class-properties --source-maps -d dist/test/ test/
	node_modules/.bin/babel --presets es2015 --plugins transform-class-properties --source-maps -d dist/crossdock/ crossdock/
	cp -R ./test/thrift ./dist/test/thrift/
	cp package.json ./dist/
	cp -R ./src/jaeger-idl ./dist/src/
	rm -rf ./dist/src/jaeger-idl/.git
	cp -R ./src/thriftrw-idl ./dist/src/

.PHONY: node_modules
node_modules:
	git submodule init -- ./src/jaeger-idl
	git submodule update
	npm install

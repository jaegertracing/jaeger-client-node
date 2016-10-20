-include crossdock/rules.mk

.PHONY: publish
publish: build-node
	npm version $(shell ./scripts/version_prompt.sh)
	git push  --set-upstream origin $(shell bash -c "git rev-parse --abbrev-ref HEAD")
	git push origin --tags
	# follow internal instructions to publish npm through uber account

.PHONY: test
test: build-node
	npm run flow & npm run lint
	./node_modules/mocha/bin/mocha --compilers js:babel-core/register
	./node_modules/.bin/mocha --compilers js:babel-register crossdock/test

.PHONY: build-node
build-node: node_modules
	rm -rf ./dist/
	node_modules/.bin/babel --presets es2015 --plugins transform-class-properties --source-maps -d dist/src/ src/
	node_modules/.bin/babel --presets es2015 --plugins transform-class-properties --source-maps -d dist/test/ test/
	node_modules/.bin/babel --presets es2015 --plugins transform-class-properties --source-maps -d dist/crossdock/ crossdock/
	cp package.json ./dist/
	npm run copy-submodule

node_modules:
	npm install

-include crossdock/rules.mk

.PHONY: publish
publish:
	npm run compile
	npm version $(shell ./scripts/version_prompt.sh)
	git push  --set-upstream origin $(shell bash -c "git rev-parse --abbrev-ref HEAD")
	git push origin --tags
	# follow internal instructions to publish npm through uber account

.PHONY: build-node
build-node: node_modules
	rm -rf ./dist/
	node_modules/.bin/babel --presets es2015 --plugins transform-class-properties -d dist/src/ src/
	cp package.json ./dist/
	npm run copy-submodule

node_modules:
	npm install

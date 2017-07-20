# Release Process

Declaring formal releases requires peer review.

* A reviewer of a pull request should recommend a new version number (patch, minor or major).
* Once your change is merged feel free to bump the version as recommended by the reviewer.
* A new version number should not be cut without peer review unless done by the project maintainer.

## Publishing a new version

* Decide on the next `major.minor.patch` release number based on [semver](http://semver.org/) guidelines
* Create a pull request titled "Preparing release {version}"
  * Update the version in [package.json](./package.json)
  * Add an entry to [CHANGELOG.md](./CHANGELOG.md)
    * Caption `{version} (yyyy-mm-dd)`
    * List significant changes since the last release
    * If there are breaking changes, point to documentation / upgrade instructions
* Get the pull request approved and merged
* Create a release on Github
  * Tag must be in the format `v{major}.{minor}.{patch}` (note the required `v` prefix)
  * Title "Release {major}.{minor}.{patch}"
  * Copy the list of changes from the change log to release description
  * If there are breaking changes, point to documentation / upgrade instructions
  * [optional] Add a thank you note to contributors
* Publish the new version to [NPM](https://www.npmjs.com/package/jaeger-client)
  * `git checkout master && git pull`
  * `git log --abbrev-commit | head` (expecting to see a tagged commit, e.g. `commit 510cebd (tag: v3.5.3)`)
  * `make build-node`
  * `npm publish` (requires permissions)
* Create a "Back to developement" pull request
  * Increment patch number in [package.json](./package.json) with `dev` suffix, e.g. if the last release was `3.5.3` then change it to `3.5.4dev`
  * Add a new entry to [CHANGELOG.md](./CHANGELOG.md)
    * Caption `{next_version} (unreleased)`
    * In place of the list of changes, add one entry "- nothing yet"
  * Get this pull request merged asap

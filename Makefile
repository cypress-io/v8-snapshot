DIR := $(dir $(abspath $(firstword $(MAKEFILE_LIST))))
TESTS_DIR = $(DIR)/dist/tests

build:
	yarn build

pretest: build clean-fixtures copy-fixtures prep-loading prep-esbuild

prep-loading:
	cd $(TESTS_DIR)/loading/fixtures/deferred-from-healthy && (if [ ! -d './node_modules' ]; then yarn install; fi)
	cd $(TESTS_DIR)/loading/fixtures/external-from-healthy && (if [ ! -d './node_modules' ]; then yarn install; fi)
	cd $(TESTS_DIR)/loading/fixtures/esm                   && (if [ ! -d './node_modules' ]; then yarn install; fi)
	cd $(TESTS_DIR)/loading/fixtures/native-modules        && (if [ ! -d './node_modules' ]; then yarn install; fi)
	rm -rf $(TESTS_DIR)/loading/fixtures/external-from-healthy/node_modules/bluebird && \
		cp -R \
			$(TESTS_DIR)/loading/fixtures/external-from-healthy/fake-bluebird \
			$(TESTS_DIR)/loading/fixtures/external-from-healthy/node_modules/bluebird

prep-esbuild:
	cd $(TESTS_DIR)/esbuild/fixtures/rewrites && (if [ ! -d './node_modules' ]; then yarn install; fi)

copy-fixtures:
	cp -R $(DIR)/src/tests/esbuild/fixtures $(TESTS_DIR)/esbuild/fixtures
	cp -R $(DIR)/src/tests/doctor/fixtures $(TESTS_DIR)/doctor/fixtures
	cp -R $(DIR)/src/tests/loading/fixtures $(TESTS_DIR)/loading/fixtures

clean-fixtures:
	rm -rf $(TESTS_DIR)/esbuild/fixtures
	rm -rf $(TESTS_DIR)/doctor/fixtures
	rm -rf $(TESTS_DIR)/loading/fixtures

.PHONY: build clean-fixtures copy-fixtures prep-loading pretest

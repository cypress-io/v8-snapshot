DIR := $(dir $(abspath $(firstword $(MAKEFILE_LIST))))
TESTS_DIR = $(DIR)/dist/tests
RIMRAF:=$(DIR)/node_modules/.bin/rimraf
CPR:=$(DIR)/node_modules/.bin/cpr

PRETEST_INSTALLS:=$(TESTS_DIR)/loading/fixtures/deferred-from-healthy/node_modules
PRETEST_INSTALLS+=$(TESTS_DIR)/loading/fixtures/external-from-healthy/node_modules
PRETEST_INSTALLS+=$(TESTS_DIR)/loading/fixtures/esm/node_modules
PRETEST_INSTALLS+=$(TESTS_DIR)/loading/fixtures/native-modules/node_modules
PRETEST_INSTALLS+=$(DIR)/example-express/node_modules

build:
	yarn build

pretest: build clean-fixtures copy-fixtures $(PRETEST_INSTALLS)
	$(RIMRAF) $(TESTS_DIR)/loading/fixtures/external-from-healthy/node_modules/bluebird && \
		$(CPR) \
			$(TESTS_DIR)/loading/fixtures/external-from-healthy/fake-bluebird \
			$(TESTS_DIR)/loading/fixtures/external-from-healthy/node_modules/bluebird

copy-fixtures:
	$(CPR) $(DIR)/src/tests/esbuild/fixtures $(TESTS_DIR)/esbuild/fixtures
	$(CPR) $(DIR)/src/tests/doctor/fixtures $(TESTS_DIR)/doctor/fixtures
	$(CPR) $(DIR)/src/tests/loading/fixtures $(TESTS_DIR)/loading/fixtures
	$(CPR) $(DIR)/src/tests/sourcemap/fixtures $(TESTS_DIR)/sourcemap/fixtures

clean-fixtures:
	$(RIMRAF) $(TESTS_DIR)/esbuild/fixtures
	$(RIMRAF) $(TESTS_DIR)/doctor/fixtures
	$(RIMRAF) $(TESTS_DIR)/loading/fixtures
	$(RIMRAF) $(TESTS_DIR)/sourcemap/fixtures

$(TESTS_DIR)/loading/fixtures/deferred-from-healthy/node_modules:
	cd $(abspath $@/..) && yarn install

$(TESTS_DIR)/loading/fixtures/external-from-healthy/node_modules:
	cd $(abspath $@/..) && yarn install

$(TESTS_DIR)/loading/fixtures/esm/node_modules:
	cd $(abspath $@/..) && yarn install

$(TESTS_DIR)/loading/fixtures/native-modules/node_modules:
	cd $(abspath $@/..) && yarn install

$(TESTS_DIR)/esbuild/fixtures/rewrites/node_modules:
	cd $(abspath $@/..) && yarn install

$(DIR)/example-express/node_modules:
	cd $(abspath $@/..) && yarn install

.PHONY: build clean-fixtures copy-fixtures pretest

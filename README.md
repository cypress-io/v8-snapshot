# v8-snapshot [![](https://github.com/thlorenz/v8-snapshot/workflows/Node/badge.svg?branch=master)](https://github.com/thlorenz/v8-snapshot/actions)

Tool to create a snapshot for Electron applications.

## Env Vars

- `SNAPSHOT_BUNDLER` overrides Go tool to create the JavaScript bundle used to snapshot
- `SNAPSHOT_KEEP_CONFIG` when set will not delete the temporary JSON config file that is
	provided to the snapshot bundler

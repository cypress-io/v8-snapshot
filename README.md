# v8-snapshot [![](https://github.com/thlorenz/v8-snapshot/workflows/Node/badge.svg?branch=master)](https://github.com/thlorenz/v8-snapshot/actions)

Tool to create a snapshot for Electron applications. Derived and extended immensly from
[electron-link](https://github.com/atom/electron-link).

- [API docs](https://cypress-io.github.io/v8-snapshot/docs)

## Env Vars

- `SNAPSHOT_BUNDLER` overrides Go binary to create the JavaScript bundle used to snapshot
- `SNAPSHOT_KEEP_CONFIG` when set will not delete the temporary JSON config file that is
	provided to the snapshot bundler
	
## External Documentation

- [Overview of Snapshot Creation and Module Loading](https://miro.com/app/board/o9J_lnvMx34=/)
- [Snapshot Architecture Miro](https://miro.com/app/board/o9J_l_DGx_0=/) focuses on TypeScript
  transpilation
- [Snapshot Require Miro](https://miro.com/app/board/o9J_l3XYLEc=/)

# v8-snapshot [![](https://github.com/thlorenz/v8-snapshot/workflows/Node/badge.svg?branch=master)](https://github.com/thlorenz/v8-snapshot/actions)

Tool to create a snapshot for Electron applications. Derived and extended immensly from
[electron-link](https://github.com/atom/electron-link).

- [API docs](https://cypress-io.github.io/v8-snapshot/docs)

## Features

v8-snapshot aids in preparing a bundle of modules of an application and/or its dependencies to
allow those modules to be snapshotted via the `mksnapshot` tool. This snapshot is then embedded
into the Electron application.

v8-snapshot then provides the snapshotted modules to [packherd][packherd] and helps in
locating modules to load from the snapshot by deriving its key from information about the
module provided by packherd.



## Env Vars

- `SNAPSHOT_BUNDLER` overrides Go binary to create the JavaScript bundle used to snapshot
- `SNAPSHOT_KEEP_CONFIG` when set will not delete the temporary JSON config file that is
	provided to the snapshot bundler
	
## External Documentation

- [Overview of Snapshot Creation and Module Loading](https://miro.com/app/board/o9J_lnvMx34=/)
- [Snapshot Architecture Miro](https://miro.com/app/board/o9J_l_DGx_0=/) focuses on TypeScript
  transpilation
- [Snapshot Require Miro](https://miro.com/app/board/o9J_l3XYLEc=/)

[packherd]:https://github.com/cypress-io/packherd
[snapshot-doctor]:file:///Volumes/d/dev/cy/perf-tr1/v8-snapshot/docs/modules/doctor_snapshot_doctor.html

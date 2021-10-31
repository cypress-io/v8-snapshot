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

## Snapshot Doctor

The [snapshot-doctor][snapshot-doctor] is responsible for finding the best possible
constellation of fully initialized (_healthy_) modules, modules includes as definitions only
(_deferred_) an modules whose code cannot be modified (_norewrites_).

Please see [docs on the `SnapshotDoctor`][snapshot-doctor-class] for more info about those.

### Snapshot Creation

When creating a snapshot the bundled code provided to it is executed and whatever ends up being
in the heap at the end is then embedded into the snapshot which is loaded whenever the app
starts up.

Once the snapshot is loaded we can retrieve fully instantiated modules from it or instantiated
them by invoking embedded functions which when called produce the `module.exports`.

However since the environment is different when generating the snapshot and not everything is
snapshottable, certain requirements need to be respected.

### Requirements

When creating a snapshot via `mksnapshot` certain requirements need to be respected:

- cannot `require` and Node.js core modules like `fs`
- cannot access and/or instantiate specific JS runtime objects like `Error` or `Promise`
- cannot load Node.js native modules

### Generating the Snapshot Script

In order to generate the snapshot script that is evaluated to produce the snapshot we perform
the following steps:

- create bundle via our [esbuild fork][esbuild-snap] and rewrite sections in order to optimize
  modules included inside the snapshot
- include this bundle inside a wrapper which sets up the `entrypoint` to use when initializing
  the snapshot via evaluation
- embedd a [resolver map][resolver-map] explained further below
- optionally embedd more, i.e. sourcemaps 

The snapshot script can be generated in a manner that only includes `node_modules`, i.e.
dependencies of the app which is recommended while developing the app in order to not have to
create a new one after each change to application files. See [GenerationOpts][generation-opts]
`nodeModulesOnly`.

### Snapshot Doctor: Steps to Optimize Included Modules

The snapshot doctor steps are documented as part of the [heal method
docs][snapshot-doctor-heal] and are as follows.

We basically are trying to initialize a module's `exports` without violating any of the
requirements.

The doctor starts with an empty `healState` which means it optimistically assumes that all
modules can be included in the snapshot fully initialized.

NOTE: that the healState can be derived from metadata collected during previous doctor runs,
but here we assume the simplified case.

The doctor then produces the initial snapshot script and starts by verifying the leaf modules
which are modules that have no imports of other user land modules.

Using that same bundle it produces different snapshot scripts, each making another module to be
verified be the entry point. This is parallelized via workers, i.e. a bundle will run as many
verifiers as the machine has CPUs.

Each produced snapshot script is executed inside a Node.js VM via the
[snapshot-verifier][snashot-verifier]. Any errors are observed, processed into warnings and the
necessary consequence taken.
The possible consequences affect the module we verified in the following manner:

- Defer: we need to _defer_ the module in order to prevent it from loading
- NoRewrite: we should not _rewrite_ the module as it results in invalid code
- None: no consequence, i.e. a light weight warning for informative purposes only

Once we did this for all leaves the doctor finds all modules that only depend on those and
repeats the process.  However the bundle that is generated takes the current (somewhat less
optimistic _heal state_ into account and rewrites the code of the dependents to _defer_ loading
the _unhealthy_ leaves.  
The next set of modules to verify is obtained via [the next stage function][doctor-next-stage].

We then repeat this process again for parents of modules we just verified and so on until we
verified all of them.

More nitty gritty details are involved like handling circular imports and it is recommended to
read the [snapshot doctor API][doctor-class] and code.

### Strict vs. Non-Strict Mode

Certain snapshot violations don't get caught out of the box when running via the verifier. For
example `new Error(..)` is fine when running inside the Node.js VM, but not so when creating
the snapshot. In that case the error is also very unhelpful as this just results in a
`Segmentation Fault` when running the `mksnapshot` tool. Therefore we need to catch those early
and with a helpful error so that the doctor can figure out the correct consequence.

To archieve that we write a slightly different snapshot script while _doctoring_, see 
[BlueprintConfig#includeStrictVerifiers][blueprint-config]. The code that patches those
problematic _Globals_ can be found inside [globals-strict.js][globals-strict-code].

## Loading From Snapshot

In order to facilitate loading from the snapshot, v8-snapshot ties into the [packerd][packherd]
resolution mechanism in order to help it obtain the _key_ to locate a fully initialized module
_exports_ or its _definition_ from the snapshotted Object that v8-snasphot also provides during
[packherd][packherd] initialization inside the [snapshot-require][snapshot-require] setup.

It uses the [resolver-map][resolver-map] in order to resolve modules without querying the file
system.



### Resolver Map

The resolver map is constructed from metadata that as [esbuild-snap][esbuild-snap] produces as
a side effect of bundling the application's dependencies and optionally the app's modules.

The keys of this map are the directory relative to the project base dir, from which a module
was resolved, concatentated with the import request string (seprated by `'***'`) and the value
the fully resolved path relative to the project base dir.

This map is embedded into the snapshot and used fast module key resolution and used to resolve
a module's key via the [getModuleKey function][getModuleKey-code].

## Env Vars

- `SNAPSHOT_BUNDLER` overrides Go binary to create the JavaScript bundle used to snapshot
- `SNAPSHOT_KEEP_CONFIG` when set will not delete the temporary JSON config file that is
	provided to the snapshot bundler
	
## External Documentation

- [Overview of Snapshot Creation and Module Loading](https://miro.com/app/board/o9J_lnvMx34=/)
- [Snapshot Architecture Miro](https://miro.com/app/board/o9J_l_DGx_0=/) focuses on TypeScript
  transpilation
- [Snapshot Require Miro](https://miro.com/app/board/o9J_l3XYLEc=/)

[doctor-next-stage]:file:///Volumes/d/dev/cy/perf-tr1/v8-snapshot/docs/classes/doctor_snapshot_doctor.SnapshotDoctor.html#_findNextStage
[doctor-class]:file:///Volumes/d/dev/cy/perf-tr1/v8-snapshot/docs/classes/doctor_snapshot_doctor.SnapshotDoctor.html

[blueprint-config]:file:///Volumes/d/dev/cy/perf-tr1/v8-snapshot/docs/modules/blueprint.html#BlueprintConfig
[globals-strict-code]:https://github.com/cypress-io/v8-snapshot/blob/99c80ff79416a061be304653dcfa2741c58b4a06/src/blueprint/globals-strict.js

[getModuleKey-code]:https://github.com/cypress-io/v8-snapshot/blob/99c80ff/src/loading/snapshot-require.ts#L43
[generation-opts]:file:///Volumes/d/dev/cy/perf-tr1/v8-snapshot/docs/modules/snapshot_generator.html#GenerationOpts
[resolver-map]:file:///Volumes/d/dev/cy/perf-tr1/v8-snapshot/docs/modules/snapshot_generator.html#GenerationOpts
[snapshot-verifier]:file:///Volumes/d/dev/cy/perf-tr1/v8-snapshot/docs/classes/snapshot_verifier.SnapshotVerifier.html
[snapshot-require]:file:///Volumes/d/dev/cy/perf-tr1/v8-snapshot/docs/modules/loading_snapshot_require.html#snapshotRequire

[packherd]:https://github.com/cypress-io/packherd
[snapshot-doctor]:file:///Volumes/d/dev/cy/perf-tr1/v8-snapshot/docs/modules/doctor_snapshot_doctor.html
[snapshot-doctor-class]:file:///Volumes/d/dev/cy/perf-tr1/v8-snapshot/docs/classes/doctor_snapshot_doctor.SnapshotDoctor.html
[snapshot-doctor-heal]:file:///Volumes/d/dev/cy/perf-tr1/v8-snapshot/docs/classes/doctor_snapshot_doctor.SnapshotDoctor.html#heal
[esbuild-snap]:https://github.com/cypress-io/esbuild/tree/thlorenz/snap

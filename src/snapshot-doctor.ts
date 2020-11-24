import { strict as assert } from 'assert'
import debug from 'debug'
import vm from 'vm'
import {
  assembleScript,
  createSnapshotScript,
  CreateSnapshotScriptOpts,
  Metadata,
} from './create-snapshot-script'

const logInfo = debug('snapgen:info')
const logDebug = debug('snapgen:debug')
const logError = debug('snapgen:error')

export type SnapshotDoctorOpts = Omit<CreateSnapshotScriptOpts, 'deferred'>

// TODO: this is now a fully working version, but ends up deferring parents when deferring a child would
// solve the problem.
// Mainly in some cases it doesn't detect that the problem can be fixed by deferring one of
// it's imports instead of the module itself.
//
// Example:
//
//  Error: Cannot require module "tty".
//  To use Node's require you need to call `snapshotResult.setGlobals` first!
//      at require (./node_modules/express/lib/router/index.js:1398:11)
//      at customRequire (./node_modules/express/lib/router/index.js:1431:26)
//      at __get_tty__ (./node_modules/express/lib/router/index.js:2758:26)
//      at Function.useColors (./node_modules/express/lib/router/index.js:2802:89)
//      at createDebug (./node_modules/express/lib/router/index.js:2623:35)
//      at Object.__commonJS../node_modules/express/lib/router/index.js (./node_modules/express/lib/router/index.js:17166:62)
//
// This problem is actually due to `var debug = require('debug')('express:router');`
// Of note is that a module itself can be fine but become a problem in other modules iff
// the result of the `require` is invoked or a property on it accessed.
// In this case it is fixable by deferring `./node_modules/debug/index.js` or similar.
//
// Approaches:
//
// - have the bundler inform us which imports are invoked and try to defer those to identify the culprit
// - defer imports one by one and in some cases permutations (expensive) to identify the culprit
// - deduce from the stack trace where the error actually originates and to identify the culprit
//   this would require us to know where in the snapshot.js each module ended up
//
export class SnapshotDoctor {
  readonly baseDirPath: string
  readonly entryFilePath: string
  readonly bundlerPath: string
  private _meta?: Metadata
  private _bundle?: string
  private _snapshotScript?: string
  private _verified: Set<string> = new Set()
  private _deferred: Set<string> = new Set()
  private _needDefer: Set<string> = new Set()

  constructor(opts: SnapshotDoctorOpts) {
    this.baseDirPath = opts.baseDirPath
    this.entryFilePath = opts.entryFilePath
    this.bundlerPath = opts.bundlerPath
  }

  async heal() {
    await this._createScript()
    this._processCurrentScript()
    while (this._needDefer.size > 0) {
      await this._createScript()
      this._processCurrentScript()
    }

    return {
      verified: this._verified,
      deferred: this._deferred,
      bundle: this._bundle!,
      snapshotScript: this._snapshotScript!,
      meta: this._meta!,
    }
  }

  _processCurrentScript() {
    assert(this._meta != null, 'expected meta data to be initialized')
    assert(this._bundle != null, 'expected bundle data to be initialized')
    for (
      let nextStage = this._findNextStage();
      nextStage.length > 0;
      nextStage = this._findNextStage()
    ) {
      for (const key of nextStage) {
        const snapshotScript = assembleScript(
          this._bundle,
          this._meta,
          this.baseDirPath,
          {
            entryPoint: `./${key}`,
          }
        )
        this._testScript(key, snapshotScript)
        this._snapshotScript = snapshotScript
      }
    }
  }

  _testScript(key: string, snapshotScript: string) {
    try {
      vm.runInNewContext(snapshotScript, undefined, {
        filename: `./${key}`,
        displayErrors: true,
      })
      this._verified.add(key)
    } catch (err) {
      logDebug(err)
      logInfo('Will defer "%s"', key)
      this._needDefer.add(key)
    }
  }

  async _createScript() {
    try {
      for (const x of this._needDefer) {
        this._deferred.add(x)
      }
      this._needDefer = new Set()

      const deferred =
        this._deferred.size > 0
          ? Array.from(this._deferred).map((x) => `./${x}`)
          : undefined

      const { meta, bundle } = await createSnapshotScript({
        baseDirPath: this.baseDirPath,
        entryFilePath: this.entryFilePath,
        bundlerPath: this.bundlerPath,
        deferred,
      })
      this._meta = meta
      this._bundle = bundle
    } catch (err) {
      logError('Failed creating initial bundle')
      throw err
    }
  }

  _findNextStage() {
    const visited =
      this._verified.size + this._deferred.size + this._needDefer.size
    return visited === 0 ? this._findLeaves() : this._findVerifiables()
  }

  _findLeaves() {
    assert(this._meta != null, 'expected meta data to be initialized')
    const leaves = []
    for (const [key, { imports }] of Object.entries(this._meta.inputs)) {
      if (imports.length === 0) leaves.push(key)
    }
    return leaves
  }

  _findVerifiables() {
    // Finds modules that only depend on previously handled modules
    assert(this._meta != null, 'expected meta data to be initialized')
    const verifiables = []
    for (const [key, { imports }] of Object.entries(this._meta.inputs)) {
      if (this._needDefer.has(key)) continue
      if (this._wasHandled(key)) continue

      const allImportsHandled = imports.every((x) => this._wasHandled(x.path))
      if (allImportsHandled) verifiables.push(key)
    }
    return verifiables
  }

  _wasHandled(key: string) {
    return this._verified.has(key) || this._deferred.has(key)
  }
}

//
// Test
//
import path from 'path'
import fs from 'fs'
const root = path.join(__dirname, '..')
const bundlerPath = path.resolve(root, '../esbuild/esbuild/snapshot')
const baseDirPath = path.resolve(root, './example-express/')
const entryFilePath = path.join(baseDirPath, 'snapshot', 'snapshot.js')

const cacheDir = path.join(baseDirPath, 'cache')
const snapshotCache = path.join(cacheDir, 'snapshot.doc.js')

;(async () => {
  try {
    const doctor = new SnapshotDoctor({
      bundlerPath,
      entryFilePath,
      baseDirPath,
    })
    const { deferred, snapshotScript } = await doctor.heal()
    fs.writeFileSync(snapshotCache, snapshotScript, 'utf8')
    logInfo({ deferred })
  } catch (err) {
    console.error(err)
  }
})()

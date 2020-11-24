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
class HealState {
  constructor(
    readonly meta: Metadata,
    readonly verified: Set<string> = new Set(),
    readonly deferred: Set<string> = new Set(),
    readonly needDefer: Set<string> = new Set()
  ) {}
}

export class SnapshotDoctor {
  readonly baseDirPath: string
  readonly entryFilePath: string
  readonly bundlerPath: string

  constructor(opts: SnapshotDoctorOpts) {
    this.baseDirPath = opts.baseDirPath
    this.entryFilePath = opts.entryFilePath
    this.bundlerPath = opts.bundlerPath
  }

  async heal() {
    const { meta, bundle } = await this._createScript()
    const healState = new HealState(meta)

    let snapshotScript = this._processCurrentScript(bundle, healState)
    while (healState.needDefer.size > 0) {
      for (const x of healState.needDefer) {
        healState.deferred.add(x)
      }
      const { bundle } = await this._createScript(healState.deferred)
      healState.needDefer.clear()
      snapshotScript = this._processCurrentScript(bundle, healState)
    }

    return {
      verified: healState.verified,
      deferred: healState.deferred,
      bundle,
      snapshotScript,
      meta,
    }
  }

  _getChildren(meta: Metadata, mdl: string) {
    const info = meta.inputs[mdl]
    assert(info != null, `unable to find ${mdl} in the metadata`)
    return info.imports.map((x) => x.path)
  }

  _processCurrentScript(
    bundle: string,
    healState: HealState
  ): string | undefined {
    let snapshotScript
    for (
      let nextStage = this._findNextStage(healState);
      nextStage.length > 0;
      nextStage = this._findNextStage(healState)
    ) {
      for (const key of nextStage) {
        snapshotScript = assembleScript(
          bundle,
          healState.meta,
          this.baseDirPath,
          {
            entryPoint: `./${key}`,
          }
        )
        this._testScript(key, snapshotScript, healState)
      }
    }
    return snapshotScript
  }

  _testScript(key: string, snapshotScript: string, healState: HealState) {
    try {
      vm.runInNewContext(snapshotScript, undefined, {
        filename: `./${key}`,
        displayErrors: true,
      })
      healState.verified.add(key)
    } catch (err) {
      logDebug(err)
      logInfo('Will defer "%s"', key)
      healState.needDefer.add(key)
    }
  }

  async _createScript(
    deferred?: Set<string>
  ): Promise<{ meta: Metadata; bundle: string }> {
    try {
      const deferredArg =
        deferred != null && deferred.size > 0
          ? Array.from(deferred).map((x) => `./${x}`)
          : undefined

      const { meta, bundle } = await createSnapshotScript({
        baseDirPath: this.baseDirPath,
        entryFilePath: this.entryFilePath,
        bundlerPath: this.bundlerPath,
        deferred: deferredArg,
      })
      return { meta, bundle }
    } catch (err) {
      logError('Failed creating initial bundle')
      throw err
    }
  }

  _findNextStage(healState: HealState) {
    const { verified, deferred, needDefer } = healState
    const visited = verified.size + deferred.size + needDefer.size
    return visited === 0
      ? this._findLeaves(healState.meta)
      : this._findVerifiables(healState)
  }

  _findLeaves(meta: Metadata) {
    const leaves = []
    for (const [key, { imports }] of Object.entries(meta.inputs)) {
      if (imports.length === 0) leaves.push(key)
    }
    return leaves
  }

  _findVerifiables(healState: HealState) {
    // Finds modules that only depend on previously handled modules
    const verifiables = []
    for (const [key, { imports }] of Object.entries(healState.meta.inputs)) {
      if (healState.needDefer.has(key)) continue
      if (this._wasHandled(key, healState.verified, healState.deferred))
        continue

      const allImportsHandled = imports.every((x) =>
        this._wasHandled(x.path, healState.verified, healState.deferred)
      )
      if (allImportsHandled) verifiables.push(key)
    }
    return verifiables
  }

  _wasHandled(key: string, verified: Set<string>, deferred: Set<string>) {
    return verified.has(key) || deferred.has(key)
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

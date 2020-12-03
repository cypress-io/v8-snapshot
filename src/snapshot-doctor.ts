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

class HealState {
  constructor(
    readonly meta: Readonly<Metadata>,
    readonly verified: Set<string> = new Set(),
    readonly deferred: Set<string> = new Set(),
    readonly needDefer: Set<string> = new Set()
  ) {}
}

function sortModulesByLeafness(meta: Metadata) {
  const sorted = []
  const handled = new Set()
  const entries = Object.entries(meta.inputs)
  while (handled.size < entries.length) {
    const justSorted = []
    // Include modules whose children have been included already
    for (const [key, { imports }] of entries) {
      if (handled.has(key)) continue
      const children = imports.map((x) => x.path)
      if (children.every((x) => handled.has(x))) {
        justSorted.push(key)
      }
    }
    // Sort them further by number of imports
    justSorted.sort((a, b) => {
      const lena = meta.inputs[a].imports.length
      const lenb = meta.inputs[b].imports.length
      return lena > lenb ? -1 : 1
    })

    for (const x of justSorted) {
      sorted.push(x)
      handled.add(x)
    }
  }
  return sorted
}

function sortDeferredByLeafness(meta: Metadata, deferred: Set<string>) {
  return sortModulesByLeafness(meta).filter((x) => deferred.has(x))
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

    const sortedDeferred = sortDeferredByLeafness(meta, healState.deferred)

    logInfo('Optimizing')
    logDebug({ deferred: sortedDeferred })

    const optimizedDeferred = await this._optimizeDeferred(meta, sortedDeferred)
    return {
      verified: healState.verified,
      deferred: optimizedDeferred,
      bundle,
      snapshotScript,
      meta,
    }
  }

  async _optimizeDeferred(meta: Metadata, deferredSortedByLeafness: string[]) {
    const optimizedDeferred: Set<string> = new Set()
    // Make each deferred an entry point and defer one of its imports to see if that maybe sufficient
    // to defer.
    for (const key of deferredSortedByLeafness) {
      const imports = meta.inputs[key].imports.map((x) => x.path)
      if (imports.length === 0) {
        optimizedDeferred.add(key)
        logInfo('Optimize: deferred leaf', key)
        continue
      }

      // Check if it was fixed by one of the optimizedDeferred added previously
      if (await this._entryWorksWhenDeferring(key, meta, optimizedDeferred)) {
        logInfo('Optimize: deferring no longer needed for', key)
        continue
      }

      // Defer all imports to verify that the module can be fixed at all, if not give up
      if (
        !(await this._entryWorksWhenDeferring(
          key,
          meta,
          new Set([...optimizedDeferred, ...imports])
        ))
      ) {
        optimizedDeferred.add(key)
        logInfo('Optimize: deferred unfixable parent', key)
        continue
      }

      // Find the one import we need to defer to fix the entry module
      let success = false
      for (const imp of imports) {
        if (
          await this._entryWorksWhenDeferring(
            key,
            meta,
            new Set([...optimizedDeferred, imp])
          )
        ) {
          optimizedDeferred.add(imp)
          logInfo('Optimize: deferred import "%s" of "%s"', imp, key)
          success = true
          break
        }
      }
      assert(
        success,
        `${key} does not need to be deferred, but only when more than one of it's imports are deferred.` +
          `This case is not yet handled.`
      )
    }
    return optimizedDeferred
  }

  async _entryWorksWhenDeferring(
    key: string,
    meta: Metadata,
    deferring: Set<string>
  ) {
    const { bundle } = await this._createScript(deferring)
    const snapshotScript = assembleScript(bundle, meta, this.baseDirPath, {
      entryPoint: `./${key}`,
    })
    const healState = new HealState(meta)
    this._testScript(key, snapshotScript, healState)
    return !healState.needDefer.has(key)
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

async function heal() {
  const doctor = new SnapshotDoctor({
    bundlerPath,
    entryFilePath,
    baseDirPath,
  })
  const { deferred, snapshotScript } = await doctor.heal()
  fs.writeFileSync(snapshotCache, snapshotScript, 'utf8')
  logInfo({ deferred })
}

;(async () => {
  try {
    await heal()
  } catch (err) {
    console.error(err)
  }
})()

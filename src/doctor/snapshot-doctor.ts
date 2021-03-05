import { strict as assert } from 'assert'
import debug from 'debug'
import fs from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { circularImports } from './circular-imports'
import {
  createBundleAsync,
  CreateSnapshotScriptOpts,
} from '../create-snapshot-script'
import { AsyncScriptProcessor } from './process-script.async'
import { SyncScriptProcessor } from './process-script.sync'
import { Entries, Metadata } from '../types'
import { bundleFileNameFromHash, createHash, ensureDirSync } from '../utils'
import {
  stringifyWarning,
  Warning,
  WarningConsequence,
  WarningsProcessor,
} from './warnings-processor'

const logInfo = debug('snapgen:info')
const logDebug = debug('snapgen:debug')
const logTrace = debug('snapgen:trace')
const logError = debug('snapgen:error')

export type SnapshotDoctorOpts = Omit<CreateSnapshotScriptOpts, 'deferred'> & {
  processSync?: boolean
  maxWorkers?: number
  previousDeferred: Set<string>
  previousHealthy: Set<string>
}

class HealState {
  processedLeaves: boolean
  constructor(
    readonly meta: Readonly<Metadata>,
    readonly deferred: Set<string> = new Set(),
    readonly healthy: Set<string> = new Set(),
    readonly needDefer: Set<string> = new Set()
  ) {
    this.processedLeaves = false
  }
}

function sortModulesByLeafness(
  meta: Metadata,
  entries: Entries<Metadata['inputs']>,
  circulars: Map<string, Set<string>>
) {
  const sorted = []
  const handled: Set<string> = new Set()

  while (handled.size < entries.length) {
    const justSorted = []
    // Include modules whose children have been included already
    for (const [key, { imports }] of entries) {
      if (handled.has(key)) continue
      const circular = circulars.get(key)
      const children = imports.map((x) => x.path)

      if (
        children.every(
          (x) => handled.has(x) || (circular != null && circular.has(x))
        )
      ) {
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

function sortDeferredByLeafness(
  meta: Metadata,
  entries: Entries<Metadata['inputs']>,
  circulars: Map<string, Set<string>>,
  deferred: Set<string>
) {
  return sortModulesByLeafness(meta, entries, circulars).filter((x) =>
    deferred.has(x)
  )
}

function pathifyAndSort(keys: Set<string>) {
  const xs = []
  for (const x of keys) {
    xs.push(`./${x}`)
  }
  xs.sort()
  return xs
}

function unpathify(keys: Set<string>) {
  const unpathified: Set<string> = new Set()
  for (const x of keys) {
    unpathified.add(x.slice(2))
  }
  return unpathified
}

export class SnapshotDoctor {
  private readonly baseDirPath: string
  private readonly entryFilePath: string
  private readonly bundlerPath: string
  private readonly norewrite?: string[]
  private readonly nodeModulesOnly: boolean
  private readonly previousDeferred: Set<string>
  private readonly previousHealthy: Set<string>
  private readonly _scriptProcessor: AsyncScriptProcessor | SyncScriptProcessor
  private readonly _warningsProcessor: WarningsProcessor

  constructor(opts: SnapshotDoctorOpts) {
    this.baseDirPath = opts.baseDirPath
    this.entryFilePath = opts.entryFilePath
    this.bundlerPath = opts.bundlerPath
    this.norewrite = opts.norewrite
    this._scriptProcessor =
      opts.processSync != null && opts.processSync
        ? new SyncScriptProcessor()
        : new AsyncScriptProcessor(opts)
    this._warningsProcessor = new WarningsProcessor(this.baseDirPath)
    this.nodeModulesOnly = opts.nodeModulesOnly
    this.previousDeferred = unpathify(opts.previousDeferred)
    this.previousHealthy = unpathify(opts.previousHealthy)
  }

  async heal(includeHealthyOrphans: boolean) {
    const { warnings, meta, bundle } = await this._createScript()

    const entries = Object.entries(meta.inputs)
    const circulars = circularImports(meta.inputs, entries)
    logDebug({ circulars })

    const healState = new HealState(
      meta,
      this.previousDeferred,
      this.previousHealthy
    )

    await this._processCurrentScript(bundle, warnings, healState, circulars)
    while (healState.needDefer.size > 0) {
      for (const x of healState.needDefer) {
        healState.deferred.add(x)
      }
      const { warnings, bundle } = await this._createScript(healState.deferred)
      healState.needDefer.clear()
      await this._processCurrentScript(bundle, warnings, healState, circulars)
    }

    const sortedDeferred = sortDeferredByLeafness(
      meta,
      entries,
      circulars,
      healState.deferred
    )

    let healthyOrphans: Set<string> = new Set()
    if (includeHealthyOrphans) {
      logInfo('Getting Healthy Orphans')
      healthyOrphans = this._determineHealthyOrphans(meta.inputs, healState)
    }

    logInfo('Optimizing')

    const {
      optimizedDeferred,
      includingImplicitsDeferred,
    } = await this._optimizeDeferred(meta, sortedDeferred, healthyOrphans)

    logInfo({ allDeferred: sortedDeferred, len: sortedDeferred.length })
    logInfo({ healthyOrphans, len: healthyOrphans.size })
    logInfo({ optimizedDeferred, len: optimizedDeferred.size })

    await this._scriptProcessor.dispose()

    return {
      healthy: pathifyAndSort(healState.healthy),
      includingImplicitsDeferred: pathifyAndSort(includingImplicitsDeferred),
      deferred: pathifyAndSort(optimizedDeferred),
      healthyOrphans: pathifyAndSort(healthyOrphans),
      bundle,
      meta,
    }
  }

  async _optimizeDeferred(
    meta: Metadata,
    deferredSortedByLeafness: string[],
    healthyOrphans: Set<string>
  ) {
    const optimizedDeferred: Set<string> = new Set(this.previousDeferred)

    // 1. Push down defers where possible, i.e. prefer deferring one import instead of an entire module
    logInfo('--- OPTIMIZE Pushing down defers ---')
    for (const key of deferredSortedByLeafness) {
      if (this.previousDeferred.has(key)) continue
      const imports = meta.inputs[key].imports.map((x) => x.path)
      if (imports.length === 0) {
        optimizedDeferred.add(key)
        logInfo('Optimize: deferred leaf', key)
        continue
      }
    }

    await Promise.all(
      deferredSortedByLeafness
        .filter(
          (key) =>
            !this.previousDeferred.has(key) && !optimizedDeferred.has(key)
        )
        .map(async (key) => {
          // Check if it was fixed by one of the optimizedDeferred added previously
          if (await this._entryWorksWhenDeferring(key, optimizedDeferred)) {
            logInfo('Optimize: deferring no longer needed for', key)
            return
          }

          // Treat the deferred as an entry point and find an import that would fix the encountered problem
          const imports = meta.inputs[key].imports.map((x) => x.path)

          // Defer all imports to verify that the module can be fixed at all, if not give up
          if (
            !(await this._entryWorksWhenDeferring(
              key,
              new Set([...optimizedDeferred, ...imports])
            ))
          ) {
            logInfo('Optimize: deferred unfixable parent', key)
            optimizedDeferred.add(key)
            return
          }

          await this._tryDeferImport(imports, key, optimizedDeferred)
        })
    )

    const includingImplicitsDeferred = new Set(optimizedDeferred)

    // 2. Find children that don't need to be explicitly deferred since they are via their deferred parent
    //    unless we're including healthy orphans.
    if (healthyOrphans.size === 0) {
      logInfo('--- OPTIMIZE Remove implicit defers ---')
      await this._removeImplicitlyDeferred(optimizedDeferred)
    }

    return { optimizedDeferred, includingImplicitsDeferred }
  }

  private async _removeImplicitlyDeferred(optimizedDeferred: Set<string>) {
    const entry = path.relative(this.baseDirPath, this.entryFilePath)
    const implicitDeferredPromises = Array.from(optimizedDeferred.keys())
      .filter((key) => !this.previousDeferred.has(key))
      .map(async (key) => {
        const fine = await this._entryWorksWhenDeferring(
          entry,
          new Set([...optimizedDeferred].filter((x) => x !== key))
        )
        return { fine, key }
      })
    const implicitDeferred = await Promise.all(implicitDeferredPromises)
    implicitDeferred
      .filter((x) => x.fine)
      .map((x) => x.key)
      .forEach((key) => {
        optimizedDeferred.delete(key)
        logInfo(
          'Optimize: removing defer of "%s", already deferred implicitly',
          key
        )
      })
  }

  private async _tryDeferImport(
    imports: string[],
    key: string,
    optimizedDeferred: Set<string>
  ) {
    const importPromises = imports
      .filter((imp) => this.previousDeferred.has(imp))
      .map(async (imp) => {
        if (
          await this._entryWorksWhenDeferring(
            key,
            new Set([...optimizedDeferred, imp])
          )
        ) {
          return { deferred: imp, fixed: true }
        } else {
          return { deferred: '', fixed: false }
        }
      })

    // Find the one import we need to defer to fix the entry module
    const fixers = new Set(
      (await Promise.all(importPromises))
        .filter((x) => x.fixed)
        .map((x) => x.deferred)
    )
    // TODO(thlorenz): track down the case where we get more than 1
    // assert(fixers.size <= 1, 'Should only find one faulty import or none')

    if (fixers.size === 0) {
      logDebug(
        `${key} does not need to be deferred, but only when more than one of it's imports are deferred.` +
          `This case is not yet handled, therefore we defer the entire module instead.`
      )
      optimizedDeferred.add(key)
      logInfo('Optimize: deferred parent with >1 problematic import', key)
    } else {
      for (const imp of fixers) {
        optimizedDeferred.add(imp)
        logInfo('Optimize: deferred import "%s" of "%s"', imp, key)
      }
    }
  }

  async _entryWorksWhenDeferring(key: string, deferring: Set<string>) {
    const entryPoint = `./${key}`
    const deferred = Array.from(deferring).map((x) => `./${x}`)
    const opts: CreateSnapshotScriptOpts = {
      baseDirPath: this.baseDirPath,
      entryFilePath: this.entryFilePath,
      bundlerPath: this.bundlerPath,
      nodeModulesOnly: this.nodeModulesOnly,
      deferred,
      includeStrictVerifiers: true,
    }
    const result = await this._scriptProcessor.createAndProcessScript(
      opts,
      entryPoint
    )

    switch (result.outcome) {
      case 'completed':
        logDebug('Verified as healthy "%s"', key)
        return true
      default:
        logDebug('%s script with entry "%s"', result.outcome, key)
        logDebug(result.error!.toString())
        logInfo('"%s" cannot be loaded for current setup (1 deferred)', key)
        return false
    }
  }

  private _determineHealthyOrphans(
    inputs: Metadata['inputs'],
    healState: HealState
  ) {
    const healthyOrphans: Set<string> = new Set()
    for (const deferred of healState.deferred) {
      const { imports } = inputs[deferred]
      imports
        .map((x) => x.path)
        .filter((p) => healState.healthy.has(p))
        .forEach((p) => healthyOrphans.add(p))
    }
    return healthyOrphans
  }

  private async _writeBundle(bundle: string) {
    const bundleTmpDir = path.join(tmpdir(), 'v8-snapshot')
    ensureDirSync(bundleTmpDir)
    const bundleHash = createHash(bundle)
    const filename = bundleFileNameFromHash(bundleHash)
    const bundlePath = path.join(bundleTmpDir, filename)
    await fs.promises.writeFile(bundlePath, bundle, 'utf8')
    return { bundleHash, bundlePath }
  }

  private async _processCurrentScript(
    bundle: string,
    warnings: Warning[],
    healState: HealState,
    circulars: Map<string, Set<string>>
  ) {
    for (const warning of this._warningsProcessor.process(warnings)) {
      const s = stringifyWarning(warning)
      switch (warning.consequence) {
        case WarningConsequence.Defer:
          logInfo('Encountered warning triggering no defer: %s', s)
          break
        case WarningConsequence.NoRewrite:
          logInfo('Encountered warning triggering no rewrite: %s', s)
          break
        case WarningConsequence.None:
          logInfo('Encountered warning without consequence: %s', s)
          break
      }
    }

    logInfo('Preparing to process current script')
    const { bundleHash, bundlePath } = await this._writeBundle(bundle)
    logDebug('Stored bundle file (%s)', bundleHash)
    logTrace(bundlePath)
    for (
      let nextStage = this._findNextStage(healState, circulars);
      nextStage.length > 0;
      nextStage = this._findNextStage(healState, circulars)
    ) {
      if (!healState.processedLeaves) {
        healState.processedLeaves = true
        // In case all leaves were determined to be healthy before we can move on to therefore
        // next step
        if (nextStage.length < 0) {
          nextStage = this._findNextStage(healState, circulars)
        }
      }
      const promises = nextStage.map(async (key) => {
        logDebug('Testing entry in isolation "%s"', key)
        const result = await this._scriptProcessor.processScript({
          bundle,
          bundlePath,
          bundleHash,
          baseDirPath: this.baseDirPath,
          entryFilePath: this.entryFilePath,
          entryPoint: `./${key}`,
        })

        assert(result != null, 'expected result from script processor')

        switch (result.outcome) {
          case 'completed':
            healState.healthy.add(key)
            logDebug('Verified as healthy "%s"', key)
            break
          case 'failed:assembleScript':
          case 'failed:verifyScript':
            logDebug('%s script with entry "%s"', result.outcome, key)
            logDebug(result.error!.toString())
            logInfo(
              '"%s" cannot be loaded for current setup (%d deferred)',
              key,
              healState.deferred.size
            )
            healState.needDefer.add(key)
            break
        }
      })
      await Promise.all(promises)
    }
  }

  private async _createScript(
    deferred?: Set<string>
  ): Promise<{
    meta: Metadata
    bundle: string
    warnings: Warning[]
  }> {
    try {
      const deferredArg =
        deferred != null && deferred.size > 0
          ? Array.from(deferred).map((x) => `./${x}`)
          : undefined

      const { warnings, meta, bundle } = await createBundleAsync({
        baseDirPath: this.baseDirPath,
        entryFilePath: this.entryFilePath,
        bundlerPath: this.bundlerPath,
        nodeModulesOnly: this.nodeModulesOnly,
        deferred: deferredArg,
        norewrite: this.norewrite,
      })

      return { warnings, meta, bundle }
    } catch (err) {
      logError('Failed creating initial bundle')
      throw err
    }
  }

  private _findNextStage(
    healState: HealState,
    circulars: Map<string, Set<string>>
  ) {
    if (healState.processedLeaves) {
      return this._findVerifiables(healState, circulars)
    } else {
      return this._findLeaves(healState)
    }
  }

  private _findLeaves(healState: HealState) {
    const leaves = []
    for (const [key, { imports }] of Object.entries(healState.meta.inputs)) {
      if (healState.healthy.has(key) || healState.deferred.has(key)) continue
      if (imports.length === 0) leaves.push(key)
    }
    return leaves
  }

  private _findVerifiables(
    healState: HealState,
    circulars: Map<string, Set<string>>
  ) {
    // Finds modules that only depend on previously handled modules
    const verifiables = []
    for (const [key, { imports }] of Object.entries(healState.meta.inputs)) {
      if (healState.needDefer.has(key)) continue
      if (this._wasHandled(key, healState.healthy, healState.deferred)) continue

      const circular = circulars.get(key) ?? new Set()
      const allImportsHandledOrCircular = imports.every(
        (x) =>
          this._wasHandled(x.path, healState.healthy, healState.deferred) ||
          circular.has(x.path)
      )
      if (allImportsHandledOrCircular) verifiables.push(key)
    }
    return verifiables
  }

  private _wasHandled(
    key: string,
    healthy: Set<string>,
    deferred: Set<string>
  ) {
    return healthy.has(key) || deferred.has(key)
  }
}

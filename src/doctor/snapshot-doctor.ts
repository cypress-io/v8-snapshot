import { strict as assert } from 'assert'
import debug from 'debug'
import fs from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { circularImports } from './circular-imports'
import { createBundleAsync } from '../create-snapshot-script'
import { AsyncScriptProcessor } from './process-script.async'
import { CreateSnapshotScriptOpts, Entries, Metadata } from '../types'
import {
  bundleFileNameFromHash,
  createHash,
  ensureDirSync,
  tryRemoveFile,
} from '../utils'
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

export type SnapshotDoctorOpts = Omit<
  CreateSnapshotScriptOpts,
  | 'deferred'
  | 'includeStrictVerifiers'
  | 'sourcemap'
  | 'sourcemapEmbed'
  | 'sourcemapInline'
  | 'sourcemapExternalPath'
> & {
  maxWorkers?: number
  previousDeferred: Set<string>
  previousHealthy: Set<string>
  previousNoRewrite: Set<string>
  forceNoRewrite: Set<string>
}

class HealState {
  processedLeaves: boolean
  constructor(
    readonly meta: Readonly<Metadata>,
    readonly healthy: Set<string> = new Set(),
    readonly deferred: Set<string> = new Set(),
    readonly norewrite: Set<string> = new Set(),
    readonly needDefer: Set<string> = new Set(),
    readonly needNorewrite: Set<string> = new Set()
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

function pathify(keys: Iterable<string>) {
  const xs = []
  for (const x of keys) {
    if (x.startsWith('.') || x.startsWith(path.sep)) {
      xs.push(x)
    } else {
      xs.push(`./${x}`)
    }
  }
  return xs
}
function pathifyAndSort(keys: Set<string>) {
  const xs = pathify(keys)
  xs.sort()
  return xs
}

function unpathify(keys: Set<string>) {
  const unpathified: Set<string> = new Set()
  for (const x of keys) {
    if (!x.startsWith('./')) {
      unpathified.add(x)
    } else {
      unpathified.add(x.slice(2))
    }
  }
  return unpathified
}

export class SnapshotDoctor {
  private readonly baseDirPath: string
  private readonly entryFilePath: string
  private readonly bundlerPath: string
  private readonly nodeModulesOnly: boolean
  private readonly previousDeferred: Set<string>
  private readonly previousHealthy: Set<string>
  private readonly previousNoRewrite: Set<string>
  private readonly forceNoRewrite: Set<string>
  private readonly nodeEnv: string
  private readonly _scriptProcessor: AsyncScriptProcessor
  private readonly _warningsProcessor: WarningsProcessor

  constructor(opts: SnapshotDoctorOpts) {
    this.baseDirPath = opts.baseDirPath
    this.entryFilePath = opts.entryFilePath
    this.bundlerPath = opts.bundlerPath
    this._scriptProcessor = new AsyncScriptProcessor(opts)
    this._warningsProcessor = new WarningsProcessor(this.baseDirPath)
    this.nodeModulesOnly = opts.nodeModulesOnly
    this.previousDeferred = unpathify(opts.previousDeferred)
    this.previousHealthy = unpathify(opts.previousHealthy)
    this.previousNoRewrite = unpathify(opts.previousNoRewrite)
    this.forceNoRewrite = unpathify(opts.forceNoRewrite)
    this.nodeEnv = opts.nodeEnv
  }

  async heal(): Promise<{
    healthy: string[]
    deferred: string[]
    norewrite: string[]
    bundle: Buffer
    meta: Metadata
  }> {
    let { warnings, meta, bundle } = await this._createScript()

    const entries = Object.entries(meta.inputs)
    const circulars = circularImports(meta.inputs, entries)
    logDebug({ circulars })

    const healState = new HealState(
      meta,
      this.previousHealthy,
      this.previousDeferred,
      new Set([...this.previousNoRewrite, ...this.forceNoRewrite])
    )

    await this._processCurrentScript(bundle, warnings, healState, circulars)
    while (healState.needDefer.size > 0 || healState.needNorewrite.size > 0) {
      for (const x of healState.needDefer) {
        healState.deferred.add(x)
        healState.healthy.delete(x)
      }
      for (const x of healState.needNorewrite) {
        healState.norewrite.add(x)
        healState.healthy.delete(x)
      }

      const { warnings, bundle } = await this._createScript(
        healState.deferred,
        healState.norewrite
      )
      healState.needDefer.clear()
      healState.needNorewrite.clear()
      await this._processCurrentScript(bundle, warnings, healState, circulars)
    }

    const sortedDeferred = sortDeferredByLeafness(
      meta,
      entries,
      circulars,
      healState.deferred
    )

    const sortedNorewrite = Array.from(healState.norewrite).sort()

    logInfo({ allDeferred: sortedDeferred, len: sortedDeferred.length })
    logInfo({ norewrite: sortedNorewrite, len: sortedNorewrite.length })

    await this._scriptProcessor.dispose()

    return {
      healthy: pathifyAndSort(healState.healthy),
      deferred: pathifyAndSort(new Set(sortedDeferred)),
      norewrite: pathify(sortedNorewrite),
      bundle,
      meta,
    }
  }

  private async _writeBundle(bundle: Buffer) {
    const bundleTmpDir = path.join(tmpdir(), 'v8-snapshot')
    ensureDirSync(bundleTmpDir)
    const bundleHash = createHash(bundle)
    const filename = bundleFileNameFromHash(bundleHash)
    const bundlePath = path.join(bundleTmpDir, filename)
    await fs.promises.writeFile(bundlePath, bundle)
    return { bundleHash, bundlePath }
  }

  private async _processCurrentScript(
    bundle: Buffer,
    warnings: Warning[],
    healState: HealState,
    circulars: Map<string, Set<string>>
  ) {
    const processedWarnings = this._warningsProcessor.process(warnings, {
      deferred: healState.deferred,
      norewrite: healState.norewrite,
    })
    for (const warning of processedWarnings) {
      const s = stringifyWarning(this.baseDirPath, warning)
      switch (warning.consequence) {
        case WarningConsequence.Defer:
          logError('Encountered warning triggering defer: %s', s)
          healState.needDefer.add(warning.location.file)
          break
        case WarningConsequence.NoRewrite:
          logError('Encountered warning triggering no-rewrite: %s', s)
          healState.needNorewrite.add(warning.location.file)
          break
        case WarningConsequence.None:
          logDebug('Encountered warning without consequence: %s', s)
          break
      }
    }

    // If norwrite is required we actually need to rebuild the bundle so we exit early
    if (healState.needNorewrite.size > 0) {
      return
    }

    logInfo('Preparing to process current script')
    const { bundleHash, bundlePath } = await this._writeBundle(bundle)
    logDebug('Stored bundle file (%s)', bundleHash)
    logTrace(bundlePath)
    /* START using (bundlePath) */ {
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
        const promises = nextStage.map(async (key): Promise<void> => {
          logDebug('Testing entry in isolation "%s"', key)
          const result = await this._scriptProcessor.processScript({
            bundlePath,
            bundleHash,
            baseDirPath: this.baseDirPath,
            entryFilePath: this.entryFilePath,
            entryPoint: `./${key}`,
            nodeEnv: this.nodeEnv,
          })

          assert(result != null, 'expected result from script processor')

          switch (result.outcome) {
            case 'completed': {
              healState.healthy.add(key)
              logDebug('Verified as healthy "%s"', key)
              break
            }
            case 'failed:assembleScript':
            case 'failed:verifyScript': {
              logError('%s script with entry "%s"', result.outcome, key)
              logError(result.error!.toString())

              const warning = this._warningsProcessor.warningFromError(
                result.error!,
                key,
                healState
              )
              if (warning != null) {
                switch (warning.consequence) {
                  case WarningConsequence.Defer: {
                    logInfo('Deferring "%s"', key)
                    healState.needDefer.add(key)
                    break
                  }
                  case WarningConsequence.NoRewrite: {
                    logInfo(
                      'Not rewriting "%s" as it results in incorrect code',
                      key
                    )
                    healState.needNorewrite.add(key)
                    break
                  }
                  case WarningConsequence.None: {
                    console.error(result.error)
                    assert.fail('I do not know what to do with this error')
                  }
                }
              }
              break
            }
          }
        })
        await Promise.all(promises)
      }
    } /* END using (bundlePath) */
    logDebug('Removing bundle file (%s)', bundleHash)
    logTrace(bundlePath)
    const err = await tryRemoveFile(bundlePath)
    if (err != null) {
      logError('Failed to remove bundle file', err)
    }
  }

  private async _createScript(
    deferred?: Set<string>,
    norewrite?: Set<string>
  ): Promise<{
    meta: Metadata
    bundle: Buffer
    warnings: Warning[]
  }> {
    const deferredArg = deferred == null ? undefined : Array.from(deferred)
    const norewriteArg = norewrite == null ? undefined : Array.from(norewrite)
    try {
      const { warnings, meta, bundle } = await createBundleAsync({
        baseDirPath: this.baseDirPath,
        entryFilePath: this.entryFilePath,
        bundlerPath: this.bundlerPath,
        nodeModulesOnly: this.nodeModulesOnly,
        sourcemapEmbed: false,
        sourcemapInline: false,
        sourcemap: false,
        includeStrictVerifiers: true,
        deferred: deferredArg,
        norewrite: norewriteArg,
      })

      return { warnings, meta: meta as Metadata, bundle }
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
      if (
        healState.healthy.has(key) ||
        healState.deferred.has(key) ||
        healState.needNorewrite.has(key)
      ) {
        continue
      }
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
      if (healState.needNorewrite.has(key)) continue
      if (healState.needDefer.has(key)) continue
      if (
        this._wasHandled(
          key,
          healState.healthy,
          healState.deferred,
          healState.norewrite
        )
      )
        continue

      const circular = circulars.get(key) ?? new Set()
      const allImportsHandledOrCircular = imports.every(
        (x) =>
          this._wasHandled(
            x.path,
            healState.healthy,
            healState.deferred,
            healState.norewrite
          ) || circular.has(x.path)
      )
      if (allImportsHandledOrCircular) verifiables.push(key)
    }
    return verifiables
  }

  private _wasHandled(
    key: string,
    healthy: Set<string>,
    deferred: Set<string>,
    norewrite: Set<string>
  ) {
    return healthy.has(key) || deferred.has(key) || norewrite.has(key)
  }
}

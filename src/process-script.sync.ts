import { strict as assert } from 'assert'
import debug from 'debug'
import {
  assembleScript,
  createBundleAsync,
  CreateSnapshotScriptOpts,
} from './create-snapshot-script'
import { SnapshotVerifier } from './snapshot-verifier'
import {
  BundleAndProcessScriptResult,
  ProcessScriptOpts,
  ProcessScriptResult,
} from './types'

const logInfo = debug('snapgen:info')

export class SyncScriptProcessor {
  private readonly _snapshotVerifier: SnapshotVerifier
  constructor() {
    logInfo('Initializing sync script processor')
    this._snapshotVerifier = new SnapshotVerifier()
  }

  async createAndProcessScript(
    opts: CreateSnapshotScriptOpts,
    entryPoint: string
  ): Promise<BundleAndProcessScriptResult> {
    return new Promise(async (resolve) => {
      const {
        baseDirPath,
        entryFilePath,
        bundlerPath,
        deferred,
        norewrite,
      } = opts
      let processOpts: ProcessScriptOpts | undefined
      try {
        const { bundle } = await createBundleAsync({
          baseDirPath,
          entryFilePath,
          bundlerPath,
          deferred,
          norewrite,
        })
        processOpts = {
          bundle,
          baseDirPath,
          entryFilePath,
          entryPoint,
        }
      } catch (err) {
        return resolve({ outcome: 'failed:bundleScript', error: err })
      }

      return this.processScript(processOpts)
    })
  }

  processScript(opts: ProcessScriptOpts): Promise<ProcessScriptResult> {
    const { bundle, baseDirPath, entryFilePath, entryPoint } = opts
    assert(bundle != null, 'sync processing requires bundle content')
    return new Promise((resolve) => {
      let snapshotScript
      try {
        snapshotScript = assembleScript(bundle, baseDirPath, entryFilePath, {
          entryPoint,
          includeStrictVerifiers: true,
        })
      } catch (err) {
        return resolve({ outcome: 'failed:assembleScript', error: err })
      }
      try {
        this._snapshotVerifier.verify(snapshotScript, entryPoint)
      } catch (err) {
        return resolve({ outcome: 'failed:verifyScript', error: err })
      }
      resolve({ outcome: 'completed' })
    })
  }

  dispose() {
    return Promise.resolve()
  }
}

import { strict as assert } from 'assert'
import debug from 'debug'
import {
  assembleScript,
  createBundleAsync,
  CreateSnapshotScriptOpts,
} from '../create-snapshot-script'
import { SnapshotVerifier } from '../snapshot-verifier'
import {
  BundleAndProcessScriptResult,
  ProcessScriptOpts,
  ProcessScriptResult,
} from '../types'

const logInfo = debug('snapgen:info')
const logTrace = debug('snapgen:trace')

export class SyncScriptProcessor {
  private readonly _snapshotVerifier: SnapshotVerifier
  private _isDisposed: boolean
  constructor() {
    logInfo('Initializing sync script processor')
    this._snapshotVerifier = new SnapshotVerifier()
    this._isDisposed = false
  }

  async createAndProcessScript(
    opts: CreateSnapshotScriptOpts,
    entryPoint: string
  ): Promise<BundleAndProcessScriptResult> {
    assert(!this._isDisposed, 'should not createAndProcessScript when disposed')
    return new Promise(async (resolve) => {
      const {
        baseDirPath,
        entryFilePath,
        bundlerPath,
        deferred,
        norewrite,
        nodeModulesOnly,
      } = opts
      let processOpts: ProcessScriptOpts | undefined
      try {
        const { bundle } = await createBundleAsync({
          baseDirPath,
          entryFilePath,
          bundlerPath,
          deferred,
          norewrite,
          nodeModulesOnly,
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
    assert(!this._isDisposed, 'should not processScript when disposed')

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
    logTrace('Disposing SyncScriptProcessor')
    this._isDisposed = true
    return Promise.resolve()
  }
}

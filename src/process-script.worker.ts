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

const snapshotVerifier = new SnapshotVerifier()

export async function createAndProcessScript(
  opts: CreateSnapshotScriptOpts,
  entryPoint: string
): Promise<BundleAndProcessScriptResult> {
  const {
    bundleFile,
    metaFile,
    baseDirPath,
    entryFilePath,
    bundlerPath,
    deferred,
  } = opts
  let processOpts: ProcessScriptOpts | undefined
  try {
    const { bundle } = await createBundleAsync({
      bundleFile,
      metaFile,
      baseDirPath,
      entryFilePath,
      bundlerPath,
      deferred,
    })
    processOpts = {
      bundle,
      baseDirPath,
      entryFilePath,
      entryPoint,
    }
  } catch (err) {
    return { outcome: 'failed:bundleScript', error: err }
  }

  return processScript(processOpts)
}

export function processScript({
  bundle,
  baseDirPath,
  entryFilePath,
  entryPoint,
}: ProcessScriptOpts): ProcessScriptResult {
  let snapshotScript
  try {
    snapshotScript = assembleScript(bundle, baseDirPath, entryFilePath, {
      entryPoint,
      includeStrictVerifiers: true,
    })
  } catch (err) {
    return { outcome: 'failed:assembleScript', error: err }
  }

  try {
    snapshotVerifier.verify(snapshotScript, `<snapshot:entry:${entryPoint}>`)
  } catch (err) {
    return { outcome: 'failed:verifyScript', error: err }
  }
  return { outcome: 'completed' }
}

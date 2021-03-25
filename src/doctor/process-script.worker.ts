import { strict as assert } from 'assert'
import debug from 'debug'
import fs from 'fs'
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
import { createHash } from '../utils'
process.env.DEBUG_COLOR = '1'

const logInfo = debug('snapgen:info')

const bundleState: { contents?: Buffer; hash?: string } = {
  contents: undefined,
  hash: undefined,
}

function getBundle(bundle?: Buffer, bundlePath?: string, bundleHash?: string) {
  if (bundle != null) return bundle

  assert(
    bundlePath != null,
    'either bundle content or path need to be provided'
  )
  assert(
    bundleHash != null,
    'either bundle content or hash need to be provided'
  )
  if (
    bundleState.hash == null ||
    bundleState.contents == null ||
    bundleState.hash !== bundleHash
  ) {
    logInfo('AsyncScriptProcessor is reading updated bundle file')
    const contents = fs.readFileSync(bundlePath)
    const hash = createHash(contents)
    assert(hash === bundleHash, 'bundle should not change while processing')

    bundleState.contents = contents
    bundleState.hash = hash
  }

  return bundleState.contents
}

const snapshotVerifier = new SnapshotVerifier()

export async function createAndProcessScript(
  opts: CreateSnapshotScriptOpts,
  entryPoint: string
): Promise<BundleAndProcessScriptResult> {
  const {
    baseDirPath,
    entryFilePath,
    bundlerPath,
    deferred,
    nodeModulesOnly,
    nodeEnv,
  } = opts
  let processOpts: ProcessScriptOpts | undefined
  try {
    const { bundle } = await createBundleAsync({
      baseDirPath,
      entryFilePath,
      bundlerPath,
      deferred,
      nodeModulesOnly,
    })
    processOpts = {
      bundle,
      baseDirPath,
      entryFilePath,
      entryPoint,
      nodeEnv,
    }
  } catch (err) {
    return { outcome: 'failed:bundleScript', error: err }
  }

  return processScript(processOpts)
}

export function processScript({
  bundle,
  bundlePath,
  bundleHash,
  baseDirPath,
  entryFilePath,
  entryPoint,
  nodeEnv,
}: ProcessScriptOpts): ProcessScriptResult {
  const bundleContent = getBundle(bundle, bundlePath, bundleHash)
  let snapshotScript
  try {
    snapshotScript = assembleScript(bundleContent, baseDirPath, entryFilePath, {
      entryPoint,
      includeStrictVerifiers: true,
      nodeEnv,
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

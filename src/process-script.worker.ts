import fs from 'fs'
import { strict as assert } from 'assert'
import {
  assembleScript,
  createBundleSync,
  CreateSnapshotScriptOpts,
} from './create-snapshot-script'
import { SnapshotVerifier } from './snapshot-verifier'
import {
  BundleAndProcessScriptResult,
  ProcessScriptOpts,
  ProcessScriptResult,
} from './types'
import { createHash } from './utils'

import debug from 'debug'
const logInfo = debug('snapgen:info')

const snapshotVerifier = new SnapshotVerifier()

const bundleState: { contents?: string; hash?: string } = {
  contents: undefined,
  hash: undefined,
}

function getBundle(bundle?: string, bundlePath?: string, bundleHash?: string) {
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
    const contents = fs.readFileSync(bundlePath, 'utf8')
    const hash = createHash(contents)
    assert(hash === bundleHash, 'bundle should not change while processing')

    bundleState.contents = contents
    bundleState.hash = hash
  }

  return bundleState.contents
}

export function createAndProcessScript(
  opts: CreateSnapshotScriptOpts,
  entryPoint: string
): BundleAndProcessScriptResult {
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
    const { bundle } = createBundleSync({
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
  bundlePath,
  bundleHash,
  baseDirPath,
  entryFilePath,
  entryPoint,
}: ProcessScriptOpts): ProcessScriptResult {
  const bundleContent = getBundle(bundle, bundlePath, bundleHash)

  let snapshotScript
  try {
    snapshotScript = assembleScript(bundleContent, baseDirPath, entryFilePath, {
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

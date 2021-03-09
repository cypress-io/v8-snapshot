import { strict as assert } from 'assert'
import path from 'path'

// TODO: include bundler with this package
const maybeBundlerPath = process.env.BUNDLER
assert(maybeBundlerPath != null, 'need to set BUNDLER env var')
export const bundlerPath = maybeBundlerPath

export function readResult(cacheDir: string) {
  const metaFile = path.join(cacheDir, 'snapshot-meta.json')
  const snapshotBundleFile = path.join(cacheDir, 'snapshot-bundle.js')
  const meta = require(metaFile)
  const exported = require(snapshotBundleFile)
  return { meta, exported }
}

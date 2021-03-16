import path from 'path'

export function readResult(cacheDir: string) {
  const metaFile = path.join(cacheDir, 'snapshot-meta.json')
  const snapshotBundleFile = path.join(cacheDir, 'snapshot-bundle.js')
  const meta = require(metaFile)
  const exported = require(snapshotBundleFile)
  return { meta, exported }
}

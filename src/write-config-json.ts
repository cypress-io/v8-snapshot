import path from 'path'
import fs from 'fs'
import { CreateBundleOpts } from './types'
import { tmpdir } from 'os'
import { createHash, ensureDirSync } from './utils'

type SnapshotConfig = {
  entryfile: string
  outfile?: string
  basedir: string
  deferred: string[]
  norewrite: string[]
  metafile: boolean
  doctor: boolean
  sourcemap: string | undefined
}

function isNonEmptyArray<T>(arr: T[] | undefined): arr is T[] {
  if (arr == null) return false
  return arr.length > 0
}

function argumentify(arr: string[]) {
  // esbuild stores modules in sub directories with backslash on windows, i.e. './lib\\deferred.js'
  // so we need to send the keys of deferred and norewrite modules in the same manner
  return path.sep === '/'
    ? arr.map((x) => {
        const PREFIX = x.startsWith('./') ? '' : './'
        return `${PREFIX}${x}`
      })
    : arr.map((x) => {
        if (x.startsWith('./')) x = x.slice(2)
        return `./${x.replace(/\//g, path.sep)}`
      })
}

/**
 * Writes the config derived from the provided opts to the [configPath].
 * The [configPath] is assumed to be writable and no checks to ensure that are performed.
 */
export function writeConfigJSON(
  opts: CreateBundleOpts,
  entryfile: string,
  basedir: string,
  sourcemapExternalPath?: string
): { configPath: string; config: SnapshotConfig } {
  const deferred = isNonEmptyArray(opts.deferred)
    ? argumentify(opts.deferred)
    : []
  const norewrite = isNonEmptyArray(opts.norewrite)
    ? argumentify(opts.norewrite)
    : []

  const sourcemap = opts.sourcemap != null ? sourcemapExternalPath : undefined
  const config: SnapshotConfig = {
    basedir,
    entryfile,
    deferred,
    norewrite,
    doctor: opts.includeStrictVerifiers ?? false,
    metafile: true,
    sourcemap,
  }
  const json = JSON.stringify(config)
  const jsonBuffer = Buffer.from(json, 'utf8')
  // TODO: set sourcemap path here and then go from there
  const configHash = createHash(jsonBuffer)
  const configPath = path.join(
    tmpdir(),
    'v8-snapshot',
    `snasphot-config.${configHash}.json`
  )
  ensureDirSync(path.dirname(configPath))
  fs.writeFileSync(configPath, jsonBuffer)

  return { configPath, config }
}

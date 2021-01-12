// @ts-ignore
import debug from 'debug'
import { strict as assert } from 'assert'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'
import { ensureDirSync } from './utils'
import { execSync } from 'child_process'
import { BlueprintConfig, scriptFromBlueprint } from './blueprint'
import { Metadata } from './types'

const logDebug = debug('snapgen:debug')
const logError = debug('snapgen:error')

export type CreateBundleOpts = {
  bundleFile?: string
  metaFile?: string
  baseDirPath: string
  entryFilePath: string
  bundlerPath: string
  deferred?: string[]
  norewrite?: string[]
}

export type CreateSnapshotScriptOpts = CreateBundleOpts & {
  auxiliaryData?: Record<string, any>
  includeStrictVerifiers?: boolean
  orphansToInclude?: string[]
}

export type CreateSnapshotScript = (
  opts: CreateSnapshotScriptOpts
) => Promise<{ snapshotScript: string }>

const orphanInjectionEntryPoint = '<entry_with_injected_orphans>'
function injectOrphans(entryPoint: string, orphans: string[]) {
  const inject = orphans.reduce(
    (acc, x) => acc + `module.exports['${x}'] = require('${x}')\n`,
    ''
  )
  return `
  __commonJS['${orphanInjectionEntryPoint}'] = function(exports, module, __dirname, __filename, require) {
    module.exports = require('${entryPoint}')
    ${inject}
  }
  `
}

const requireDefinitions = (
  bundle: string,
  entryPoint: string,
  orphansToInclude?: string[]
) => {
  const injectedOrphans =
    orphansToInclude == null
      ? null
      : injectOrphans(entryPoint, orphansToInclude)

  return {
    code: `
  //
  // <esbuild bundle>
  //
  ${bundle}
  //
  // </esbuild bundle>
  //
  ${injectedOrphans != null ? injectedOrphans : ''}

  customRequire.definitions = __commonJS 
`,
    mainModuleRequirePath:
      injectedOrphans == null ? entryPoint : orphanInjectionEntryPoint,
  }
}

function getMainModuleRequirePath(basedir: string, entryFullPath: string) {
  logDebug('Obtaining main module require path given', {
    basedir,
    entryFullPath,
  })
  const relPath = path.relative(basedir, entryFullPath)
  return `./${relPath}`
}

/**
 * Assembles a snapshot script for the provided bundle configured for the
 * provided meta data, basedir and opts.
 *
 * @param bundle contents of the bundle created previously
 * @param basedir project root directory
 * @param opts
 *
 * @return the contents of the assembled script
 */
export function assembleScript(
  bundle: string,
  basedir: string,
  entryFilePath: string,
  opts: {
    auxiliaryData?: Record<string, any>
    entryPoint?: string
    includeStrictVerifiers?: boolean
    orphansToInclude?: string[]
  } = {}
) {
  const includeStrictVerifiers = opts.includeStrictVerifiers ?? false
  const auxiliaryDataString = JSON.stringify(opts.auxiliaryData || {})

  const mainModuleRequirePath =
    opts.entryPoint ?? getMainModuleRequirePath(basedir, entryFilePath)

  assert(
    mainModuleRequirePath != null,
    'metadata should have exactly one entry point'
  )

  const indentedBundle = bundle.split('\n').join('\n  ')
  const defs = requireDefinitions(
    indentedBundle,
    mainModuleRequirePath,
    opts.orphansToInclude
  )

  const config: BlueprintConfig = {
    processPlatform: process.platform,
    processNodeVersion: process.version,
    mainModuleRequirePath: JSON.stringify(defs.mainModuleRequirePath),
    auxiliaryData: auxiliaryDataString,
    customRequireDefinitions: defs.code,
    includeStrictVerifiers,
  }
  return scriptFromBlueprint(config)
}

/**
 * Creates bundle and meta file via the provided bundler written in Go
 * and reads and returns its contents asynchronously.
 *
 * @param opts
 * @return promise of the paths and contents of the created bundle and related metadata
 */
export async function createBundleAsync(
  opts: CreateBundleOpts
): Promise<{
  metafile: string
  outfile: string
  meta: Metadata
  bundle: string
}> {
  const { outfile, metafile } = createBundle(opts)
  logDebug('Reading', { outfile, metafile })
  const bundle = await fs.promises.readFile(outfile, 'utf8')
  const meta = require(metafile)
  return { outfile, metafile, bundle, meta }
}

/**
 * Creates bundle and meta file via the provided bundler written in Go
 * and reads and returns its contents synchronously.
 *
 * @param opts
 * @return the paths and contents of the created bundle and related metadata
 */
export function createBundleSync(
  opts: CreateBundleOpts
): {
  metafile: string
  outfile: string
  meta: Metadata
  bundle: string
} {
  const { outfile, metafile } = createBundle(opts)
  logDebug('Reading', { outfile, metafile })
  const bundle = fs.readFileSync(outfile, 'utf8')
  const meta = require(metafile)
  return { outfile, metafile, bundle, meta }
}

/**
 * Creates a bundle for the provided entry file and then assembles a
 * snapshot script from them.
 *
 * @param opts
 * @return the paths and contents of the created bundle and related metadata
 * as well as the created snapshot script
 */
export async function createSnapshotScript(
  opts: CreateSnapshotScriptOpts
): Promise<{ snapshotScript: string; meta: Metadata; bundle: string }> {
  const { bundle, meta } = await createBundleAsync(opts)

  logDebug('Assembling snapshot script')
  const script = assembleScript(bundle, opts.baseDirPath, opts.entryFilePath, {
    auxiliaryData: opts.auxiliaryData,
    includeStrictVerifiers: opts.includeStrictVerifiers,
    orphansToInclude: opts.orphansToInclude,
  })

  return Promise.resolve({ snapshotScript: script, meta, bundle })
}

function createBundle(opts: CreateBundleOpts) {
  const bundleTmpDir = path.join(tmpdir(), 'v8-snapshot')
  ensureDirSync(bundleTmpDir)

  const outfile = path.join(bundleTmpDir, opts.bundleFile || 'bundle.js')
  const metafile = path.join(bundleTmpDir, opts.metaFile || 'meta.json')
  const basedir = path.resolve(process.cwd(), opts.baseDirPath)

  const cmd =
    opts.bundlerPath +
    ` --outfile=${outfile}` +
    ` --basedir=${basedir}` +
    ` --metafile=${metafile}` +
    (opts.deferred != null ? ` --deferred='${opts.deferred.join(',')}'` : '') +
    (opts.norewrite != null
      ? ` --norewrite='${opts.norewrite.join(',')}'`
      : '') +
    ` ${opts.entryFilePath}`

  logDebug('Running "%s"', cmd)
  try {
    execSync(cmd, { stdio: ['pipe', 'pipe', 'inherit'], cwd: basedir })
  } catch (err) {
    if (err.stderr != null) {
      logError(err.stderr.toString())
    }
    if (err.stdout != null) {
      logDebug(err.stdout.toString())
    }
    throw new Error(`Failed command: "${cmd}"`)
  }

  return { outfile, metafile }
}

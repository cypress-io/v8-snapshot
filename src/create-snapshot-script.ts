import debug from 'debug'
import { strict as assert } from 'assert'
import path from 'path'
import { execSync } from 'child_process'
import { BlueprintConfig, scriptFromBlueprint } from './blueprint'
import { Metadata } from './types'
import {
  CreateBundle,
  packherd,
  CreateBundleOpts as PackherdCreateBundleOpts,
  CreateBundleResult,
} from 'packherd'

const logDebug = debug('snapgen:debug')
const logError = debug('snapgen:error')

export type CreateBundleOpts = {
  baseDirPath: string
  entryFilePath: string
  bundlerPath: string
  nodeModulesOnly: boolean
  deferred?: string[]
  norewrite?: string[]
}

export type CreateSnapshotScriptOpts = CreateBundleOpts & {
  auxiliaryData?: Record<string, any>
  includeStrictVerifiers?: boolean
}

export type CreateSnapshotScript = (
  opts: CreateSnapshotScriptOpts
) => Promise<{ snapshotScript: string }>

const requireDefinitions = (bundle: string, entryPoint: string) => {
  return {
    code: `
  //
  // <esbuild bundle>
  //
  ${bundle}
  //
  // </esbuild bundle>
  //

  customRequire.definitions = __commonJS 
`,
    mainModuleRequirePath: entryPoint,
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
  const defs = requireDefinitions(indentedBundle, mainModuleRequirePath)

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
  warnings: CreateBundleResult['warnings']
  meta: Metadata
  bundle: string
}> {
  return createBundle(opts)
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
  })

  return { snapshotScript: script, meta, bundle }
}

function outfileText(outfile: { contents: string }) {
  return Buffer.from(outfile.contents, 'hex').toString('utf8')
}

const makePackherdCreateBundle: (opts: CreateBundleOpts) => CreateBundle = (
  opts: CreateBundleOpts
) => (popts: PackherdCreateBundleOpts) => {
  const basedir = path.resolve(process.cwd(), opts.baseDirPath)
  const cmd =
    opts.bundlerPath +
    ` --basedir=${basedir}` +
    (opts.deferred != null && opts.deferred.length > 0
      ? ` --deferred='${opts.deferred.join(',')}'`
      : '') +
    (opts.norewrite != null && opts.norewrite.length > 0
      ? ` --norewrite='${opts.norewrite.join(',')}'`
      : '') +
    ` ${popts.entryFilePath}`

  logDebug('Running "%s"', cmd)

  const _MB = 1024 * 1024
  try {
    const stdout = execSync(cmd, {
      maxBuffer: 200 * _MB,
      cwd: basedir,
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const { warnings, outfiles } = JSON.parse(stdout.toString())

    assert(outfiles.length >= 2, 'need at least two outfiles, bundle and meta')
    const bundle = { text: outfileText(outfiles[0]) }
    const meta = { text: outfileText(outfiles[1]) }
    return Promise.resolve({ warnings, outputFiles: [bundle, meta] })
  } catch (err) {
    if (err.stderr != null) {
      logError(err.stderr.toString())
    }
    if (err.stdout != null) {
      logDebug(err.stdout.toString())
    }
    return Promise.reject(new Error(`Failed command: "${cmd}"`))
  }
}

async function createBundle(opts: CreateBundleOpts) {
  const { warnings, bundle, meta } = await packherd({
    entryFile: opts.entryFilePath,
    nodeModulesOnly: opts.nodeModulesOnly,
    createBundle: makePackherdCreateBundle(opts),
  })
  return { warnings, bundle, meta }
}

// @ts-ignore
import debug from 'debug'
import { strict as assert } from 'assert'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'
import { ensureDirSync } from './utils'
import { execSync } from 'child_process'
import { BlueprintConfig, scriptFromBlueprint } from './blueprint'

const logDebug = debug('snapgen:debug')
const logError = debug('snapgen:error')

export type CreateBundleOpts = {
  baseDirPath: string
  entryFilePath: string
  bundlerPath: string
  deferred?: string[]
}

export type CreateSnapshotScriptOpts = CreateBundleOpts & {
  deferred?: string[]
  auxiliaryData?: Record<string, any>
  includeStrictVerifiers?: boolean
}

export type CreateSnapshotScript = (
  opts: CreateSnapshotScriptOpts
) => Promise<{ snapshotScript: string }>

export type Metadata = {
  inputs: Record<string, { bytes: number; imports: { path: string }[] }>
  outputs: Record<
    string,
    {
      inputs: Record<
        string,
        {
          bytesInOutput: number
          fileInfo: {
            identifierName: string
            fullPath: string
            isEntryPoint: boolean
            replacementFunction: string
          }
        }
      >
      bytes: number
    }
  >
}

const requireDefinitions = (bundle: string) => `
  //
  // <esbuild bundle>
  //
  ${bundle}
  //
  // </esbuild bundle>
  //

  customRequire.definitions = __commonJS 
`

function getMainModuleRequirePath(meta: Metadata, basedir: string) {
  for (const output of Object.values(meta.outputs)) {
    for (const input of Object.values(output.inputs)) {
      const { fullPath, isEntryPoint } = input.fileInfo
      const relPath = path.relative(basedir, fullPath)
      if (isEntryPoint) {
        return `./${relPath}`
      }
    }
  }
}

/**
 * Assembles a snapshot script for the provided bundle configured for the
 * provided meta data, basedir and opts.
 *
 * @param bundle contents of the bundle created previously
 * @param meta   related metadata of bundle
 * @param basedir project root directory
 * @param opts
 *
 * @return the contents of the assembled script
 */
export function assembleScript(
  bundle: string,
  meta: Metadata,
  basedir: string,
  opts: {
    auxiliaryData?: Record<string, any>
    entryPoint?: string
    includeStrictVerifiers?: boolean
  } = {}
) {
  const auxiliaryDataString = JSON.stringify(opts.auxiliaryData || {})

  const mainModuleRequirePath =
    opts.entryPoint ?? getMainModuleRequirePath(meta, basedir)

  assert(
    mainModuleRequirePath != null,
    'metadata should have exactly one entry point'
  )

  const indentedBundle = bundle.split('\n').join('\n  ')
  const customRequireDefinitions = requireDefinitions(indentedBundle)

  const includeStrictVerifiers = opts.includeStrictVerifiers ?? false

  const config: BlueprintConfig = {
    processPlatform: process.platform,
    processNodeVersion: process.version,
    mainModuleRequirePath: JSON.stringify(mainModuleRequirePath),
    auxiliaryData: auxiliaryDataString,
    customRequireDefinitions,
    includeStrictVerifiers,
  }
  return scriptFromBlueprint(config)
}

/**
 * Creates bundle and meta file via the provided bundler written in Go
 *
 * @param opts
 * @return the paths and contents of the created bundle and related metadata
 */
export async function createBundle(
  opts: CreateBundleOpts
): Promise<{
  metafile: string
  outfile: string
  meta: Metadata
  bundle: string
}> {
  const bundleTmpDir = path.join(tmpdir(), 'v8-snapshot')
  ensureDirSync(bundleTmpDir)

  const outfile = path.join(bundleTmpDir, 'bundle.js')
  const metafile = path.join(bundleTmpDir, 'meta.json')
  const basedir = path.resolve(process.cwd(), opts.baseDirPath)

  const cmd =
    opts.bundlerPath +
    ` --outfile=${outfile}` +
    ` --basedir=${basedir}` +
    ` --metafile=${metafile}` +
    (opts.deferred != null ? ` --deferred='${opts.deferred.join(',')}'` : '') +
    ` ${opts.entryFilePath}`

  logDebug('Running "%s"', cmd)
  try {
    execSync(cmd, { stdio: ['pipe', 'pipe', 'inherit'] })
  } catch (err) {
    if (err.stderr != null) {
      logError(err.stderr.toString())
    }
    if (err.stdout != null) {
      logDebug(err.stdout.toString())
    }
    throw new Error(`Failed command: "${cmd}"`)
  }

  logDebug('Reading', { outfile, metafile })
  const bundle = await fs.promises.readFile(outfile, 'utf8')
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
  const { bundle, meta } = await createBundle(opts)

  // Assemble Snapshot Script
  logDebug('Assembling snapshot script')
  const script = assembleScript(bundle, meta, opts.baseDirPath, {
    auxiliaryData: opts.auxiliaryData,
    includeStrictVerifiers: opts.includeStrictVerifiers,
  })

  return Promise.resolve({ snapshotScript: script, meta, bundle })
}

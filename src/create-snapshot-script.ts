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

export type CreateSnapshotScriptOpts = {
  baseDirPath: string
  entryFilePath: string
  bundlerPath: string
  auxiliaryData?: Record<string, any>
}
export type CreateSnapshotScript = (
  opts: CreateSnapshotScriptOpts
) => Promise<{ snapshotScript: string }>

type Metadata = {
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

// Modified from electron-link/src/generate-snapshot-script.js
function assembleScript(
  bundle: string,
  meta: Metadata,
  basedir: string,
  auxiliaryData?: Record<string, any>
) {
  const auxiliaryDataString = JSON.stringify(auxiliaryData || {})

  const mainModuleRequirePath = getMainModuleRequirePath(meta, basedir)
  assert(
    mainModuleRequirePath != null,
    'metadata should have exactly one entry point'
  )

  const indentedBundle = bundle.split('\n').join('\n  ')
  const customRequireDefinitions = requireDefinitions(indentedBundle)

  const config: BlueprintConfig = {
    processPlatform: process.platform,
    processNodeVersion: process.version,
    mainModuleRequirePath: JSON.stringify(mainModuleRequirePath),
    auxiliaryData: auxiliaryDataString,
    customRequireDefinitions,
  }
  return scriptFromBlueprint(config)
}

export function createSnapshotScript(
  opts: CreateSnapshotScriptOpts
): Promise<{ snapshotScript: string }> {
  // 1. Create bundle and meta file via the provided bundler written in Go
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

  // 2. Read bundle and meta file in order to construct the snapshot script
  logDebug('Loading', { outfile, metafile })
  const bundle = fs.readFileSync(outfile, 'utf8')
  const meta = require(metafile)

  // 3. Assemble Snapshot Script
  logDebug('Assembling snapshot script')
  const script = assembleScript(
    bundle,
    meta,
    opts.baseDirPath,
    opts.auxiliaryData
  )

  return Promise.resolve({ snapshotScript: script })
}

module.exports = { createSnapshotScript }

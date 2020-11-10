// @ts-ignore
import debug from 'debug'
import { strict as assert } from 'assert'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'
import { ensureDirSync } from './utils'
import { execSync } from 'child_process'

const logDebug = debug('snapgen:debug')
const logError = debug('snapgen:error')

const blueprintPath = path.join(__dirname, 'blueprint.js')

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

const requireDefinitions = (bundle: string, definitions: string[]) => `
  customRequire.definitions = (function (require) {
    //
    // Start Bundle generated with esbuild
    //
    ${bundle}
    //
    // End Bundle generated with esbuild
    //

    return { ${definitions.join('\n')} 
    }
  })(customRequire)
`

// Modified from electron-link/src/generate-snapshot-script.js
function assembleScript(
  bundle: string,
  meta: Metadata,
  baseDir: string,
  auxiliaryData?: Record<string, any>
) {
  let snapshotScript = fs.readFileSync(blueprintPath, 'utf8')

  //
  // Platform specifics
  //
  snapshotScript = snapshotScript.replace('processPlatform', process.platform)
  snapshotScript = snapshotScript.replace(
    'const pathSeparator = null',
    `const pathSeparator = ${JSON.stringify(path.sep)}`
  )

  //
  // Auxiliary Data
  //
  const auxiliaryDataString = JSON.stringify(auxiliaryData || {})
  const auxiliaryDataAssignment = 'var snapshotAuxiliaryData = {}'
  const auxiliaryDataAssignmentStartIndex = snapshotScript.indexOf(
    auxiliaryDataAssignment
  )
  const auxiliaryDataAssignmentEndIndex =
    auxiliaryDataAssignmentStartIndex + auxiliaryDataAssignment.length
  snapshotScript =
    snapshotScript.slice(0, auxiliaryDataAssignmentStartIndex) +
    `var snapshotAuxiliaryData = ${auxiliaryDataString};` +
    snapshotScript.slice(auxiliaryDataAssignmentEndIndex)

  //
  // require definitions and mainModuleRequirePath
  //
  let mainModuleRequirePath: string | undefined
  const definitionsAssignment = 'customRequire.definitions = {}'
  const definitions = []
  for (const output of Object.values(meta.outputs)) {
    for (const input of Object.values(output.inputs)) {
      const { fullPath, replacementFunction, isEntryPoint } = input.fileInfo
      const relPath = path.relative(baseDir, fullPath)
      definitions.push(`
      './${relPath}': function (
          exports,
          module,
          __filename,
          __dirname) { ${replacementFunction}(exports, module) },`)
      if (isEntryPoint) {
        mainModuleRequirePath = `./${relPath}`
      }
    }
  }
  assert(
    mainModuleRequirePath != null,
    'metadata should have exactly one entry point'
  )
  snapshotScript = snapshotScript.replace(
    'mainModuleRequirePath',
    JSON.stringify(mainModuleRequirePath)
  )

  const indentedBundle = bundle.split('\n').join('\n    ')
  const requireDefs = requireDefinitions(indentedBundle, definitions)
  snapshotScript = snapshotScript.replace(definitionsAssignment, requireDefs)

  return snapshotScript
}

export function createSnapshotScript(
  opts: CreateSnapshotScriptOpts
): Promise<{ snapshotScript: string }> {
  // 1. Create bundle and meta file via the provided bundler written in Go
  const bundleTmpDir = path.join(tmpdir(), 'v8-snapshot')
  ensureDirSync(bundleTmpDir)

  const outfile = path.join(bundleTmpDir, 'bundle.js')
  const metafile = path.join(bundleTmpDir, 'meta.json')

  const cmd = `${opts.bundlerPath} --outfile=${outfile} --metafile=${metafile} ${opts.entryFilePath}`
  logDebug('Running "%s"', cmd)
  try {
    execSync(
      `${opts.bundlerPath} --outfile=${outfile} --metafile=${metafile} ${opts.entryFilePath}`,
      {
        stdio: ['pipe', 'pipe', 'inherit'],
      }
    )
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

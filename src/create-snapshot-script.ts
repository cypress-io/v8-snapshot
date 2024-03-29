import debug from 'debug'
import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import path from 'path'
import { execSync, ExecSyncOptions, StdioOptions } from 'child_process'
import { BlueprintConfig, scriptFromBlueprint } from './blueprint'
import { CreateBundleOpts, CreateSnapshotScriptOpts, Metadata } from './types'
import {
  CreateBundle,
  packherd,
  CreateBundleOpts as PackherdCreateBundleOpts,
  CreateBundleResult,
  CreateBundleSourcemap,
} from 'packherd'
import { dependencyMapArrayFromInputs } from './meta/dependency-map'
import { writeConfigJSON } from './write-config-json'
import { tryRemoveFileSync } from './utils'

const logInfo = debug('snapgen:info')
const logDebug = debug('snapgen:debug')
const logTrace = debug('snapgen:trace')
const logError = debug('snapgen:error')

const keepConfig = process.env.SNAPSHOT_KEEP_CONFIG != null

export const BUNDLE_WRAPPER_OPEN = Buffer.from(
  `
  //
  // <esbuild bundle>
  //
`,
  'utf8'
)

export const BUNDLE_WRAPPER_CLOSE = Buffer.from(
  `
  //
  // </esbuild bundle>
  //

  customRequire.definitions = __commonJS 
`,
  'utf8'
)

export type CreateSnapshotScript = (
  opts: CreateSnapshotScriptOpts
) => Promise<{ snapshotScript: string }>

const requireDefinitions = (bundle: Buffer, entryPoint: string) => {
  const code = Buffer.concat([
    BUNDLE_WRAPPER_OPEN,
    bundle,
    BUNDLE_WRAPPER_CLOSE,
  ])
  return {
    code,
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
 * @param entryFilepath
 * @param opts
 *
 * @return the contents of the assembled script
 */
export function assembleScript(
  bundle: Buffer,
  basedir: string,
  entryFilePath: string,
  opts: {
    auxiliaryData?: Record<string, any>
    entryPoint?: string
    includeStrictVerifiers?: boolean
    sourceMap?: Buffer
    sourcemapEmbed: boolean
    sourcemapInline: boolean
    sourcemapExternalPath: string | undefined
    nodeEnv: string
    resolverMap?: Record<string, string>
    meta?: Metadata
  }
): { script: Buffer; processedSourceMap?: string } {
  const includeStrictVerifiers = opts.includeStrictVerifiers ?? false
  const auxiliaryData = Object.assign({}, opts.auxiliaryData)

  // Prefer the provided resolver map over the one found in the current meta data.
  // This allows us to use the app entry file when generating this map and another
  // snapshotting specific entry, possibly generated, to create the snapshot.
  const resolverMap = opts.resolverMap ?? opts.meta?.resolverMap
  if (resolverMap != null) {
    if (logDebug.enabled) {
      logDebug(
        'Embedding resolver map with %d entries into snapshot',
        Object.keys(resolverMap).length
      )
    }
    auxiliaryData.resolverMap = resolverMap
  }
  if (opts.meta?.inputs != null) {
    const mapArray = dependencyMapArrayFromInputs(opts.meta.inputs)
    logDebug('Embedding dependency map into snapshot')
    auxiliaryData.dependencyMapArray = mapArray
  }

  const auxiliaryDataString = JSON.stringify(auxiliaryData)

  const mainModuleRequirePath =
    opts.entryPoint ?? getMainModuleRequirePath(basedir, entryFilePath)

  assert(
    mainModuleRequirePath != null,
    'metadata should have exactly one entry point'
  )

  const defs = requireDefinitions(bundle, mainModuleRequirePath)

  const relSourcemapExternalPath =
    opts.sourcemapExternalPath != null
      ? path
          .relative(basedir, opts.sourcemapExternalPath)
          .replace(path.sep, '/') // consistent url even on unixlike and windows
      : undefined

  const config: BlueprintConfig = {
    processPlatform: process.platform,
    processNodeVersion: process.version,
    mainModuleRequirePath: JSON.stringify(defs.mainModuleRequirePath),
    auxiliaryData: auxiliaryDataString,
    customRequireDefinitions: defs.code,
    includeStrictVerifiers,
    sourceMap: opts.sourceMap,
    sourcemapEmbed: opts.sourcemapEmbed,
    sourcemapInline: opts.sourcemapInline,
    sourcemapExternalPath: relSourcemapExternalPath,
    nodeEnv: opts.nodeEnv,
    basedir,
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
export async function createBundleAsync(opts: CreateBundleOpts): Promise<{
  warnings: CreateBundleResult['warnings']
  meta: Metadata
  bundle: Buffer
  sourceMap?: Buffer
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
): Promise<{ snapshotScript: Buffer; meta: Metadata; bundle: Buffer }> {
  const { bundle, sourceMap, meta } = await createBundleAsync(opts)

  logDebug('Assembling snapshot script')
  const { script } = assembleScript(
    bundle,
    opts.baseDirPath,
    opts.entryFilePath,
    {
      auxiliaryData: opts.auxiliaryData,
      includeStrictVerifiers: opts.includeStrictVerifiers,
      sourceMap,
      sourcemapEmbed: opts.sourcemapEmbed,
      sourcemapInline: opts.sourcemapInline,
      sourcemapExternalPath: opts.sourcemapExternalPath,
      nodeEnv: opts.nodeEnv,
      resolverMap: opts.resolverMap,
      meta,
    }
  )

  return { snapshotScript: script, meta: meta as Metadata, bundle }
}

function stringToBuffer(contents: string) {
  return Buffer.from(contents, 'hex')
}

const makePackherdCreateBundle: (opts: CreateBundleOpts) => CreateBundle =
  (opts: CreateBundleOpts) => (popts: PackherdCreateBundleOpts) => {
    const basedir = path.resolve(process.cwd(), opts.baseDirPath)
    const { configPath, config } = writeConfigJSON(
      opts,
      popts.entryFilePath,
      basedir,
      opts.sourcemapExternalPath
    )

    const cmd = `${opts.bundlerPath} ${configPath}`
    logDebug('Running "%s"', cmd)
    logTrace(config)

    const _MB = 1024 * 1024
    const execOpts: ExecSyncOptions = Object.assign(
      {
        maxBuffer: 600 * _MB,
        cwd: basedir,
      },
      // Windows doesn't properly support piping stdio
      process.platform === 'win32'
        ? {}
        : { stdio: ['pipe', 'pipe', 'pipe'] as StdioOptions }
    )

    try {
      const stdout = execSync(cmd, execOpts)
      const { warnings, outfiles, metafile } = JSON.parse(stdout.toString())

      assert(outfiles.length >= 1, 'need at least one outfile')
      assert(metafile != null, 'expected metafile to be included in result')
      assert(
        metafile.contents != null,
        'expected metafile to include contents buffer'
      )

      const bundleContents = outfiles[0].contents
      const bundle = { contents: stringToBuffer(bundleContents) }

      const includedSourcemaps = outfiles.length === 2
      if (!!opts.sourcemap) {
        assert(
          includedSourcemaps,
          'should include sourcemap when sourcemap is configured'
        )
      } else {
        assert(
          !includedSourcemaps,
          'should only include sourcemap when sourcemap is configured'
        )
      }
      assert(
        opts.sourcemap != true || opts.sourcemapExternalPath != null,
        'should include sourcemapExternalPath when sourcemap option is set'
      )

      if (opts.sourcemap) {
        logInfo(
          'External sourcemaps written to "%s"',
          opts.sourcemapExternalPath
        )
      }

      let sourceMap: CreateBundleSourcemap | undefined = undefined
      if (opts.sourcemapExternalPath != null) {
        try {
          sourceMap = {
            contents: readFileSync(opts.sourcemapExternalPath),
          }
        } catch (err: any) {
          logError(
            'Failed to read sourcemap from "%s"',
            opts.sourcemapExternalPath
          )
        }
      }

      const metadata: Metadata = JSON.parse(
        stringToBuffer(metafile.contents).toString()
      )
      const result: CreateBundleResult = {
        warnings,
        outputFiles: [bundle],
        sourceMap,
        metafile: metadata,
      }
      return Promise.resolve(result)
    } catch (err: any) {
      if (err.stderr != null) {
        logError(err.stderr.toString())
      }
      if (err.stdout != null) {
        logDebug(err.stdout.toString())
      }
      logError(err)
      return Promise.reject(new Error(`Failed command: "${cmd}"`))
    } finally {
      if (!keepConfig) {
        const err = tryRemoveFileSync(configPath)
        // We log the error here, but don't fail since the config file might not have been created and thus removing it
        // fails. Also removing this temp file is not essential to snapshot creation.
        if (err != null) {
          logError(err)
        }
      } else {
        logInfo('Kept config at %s', configPath)
      }
    }
  }

async function createBundle(opts: CreateBundleOpts) {
  const { warnings, bundle, sourceMap, meta } = await packherd({
    entryFile: opts.entryFilePath,
    nodeModulesOnly: opts.nodeModulesOnly,
    createBundle: makePackherdCreateBundle(opts),
  })
  return { warnings, bundle, sourceMap, meta: meta as Metadata }
}

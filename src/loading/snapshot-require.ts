import debug from 'debug'
import path from 'path'
import type { GetModuleKey, PackherdTranspileOpts } from 'packherd'
import { packherdRequire } from 'packherd/dist/src/require.js'
import { moduleMapper } from './module_negotiator'
import { Snapshot, SnapshotAuxiliaryData } from '../types'
import { EMBEDDED } from '../constants'

const logInfo = debug('snapshot:info')
const logError = debug('snapshot:error')
const logDebug = debug('snapshot:debug')
const logTrace = debug('snapshot:trace')

const RESOLVER_MAP_KEY_SEP = '***'

function createGetModuleKey(resolverMap?: Record<string, string>) {
  const getModuleKey: GetModuleKey = ({ moduleUri, baseDir, parent }) => {
    if (resolverMap != null && parent != null) {
      const relParentDir = path.relative(baseDir, parent.path)
      const resolverKey = `${relParentDir}${RESOLVER_MAP_KEY_SEP}${moduleUri}`
      const resolved = resolverMap[resolverKey]
      // Module cache prefixes with `./` while the resolver map doesn't
      if (resolved != null) {
        const moduleKey = `./${resolved}`
        return { moduleKey, moduleRelativePath: moduleKey }
      }
    }

    const moduleUriIsAbsolutePath = path.isAbsolute(moduleUri)

    // If we cannot resolve it via the map and it is a node_module id we return as is as it has to be
    // resolved via Node.js
    if (!moduleUriIsAbsolutePath && !moduleUri.startsWith('.')) {
      return { moduleKey: undefined, moduleRelativePath: undefined }
    }

    let moduleRelativePath = moduleUriIsAbsolutePath
      ? path.relative(baseDir, moduleUri)
      : moduleUri

    if (!moduleRelativePath.startsWith('.')) {
      // Change things like `node_modules/..` to `./node_modules/..`
      moduleRelativePath = `./${moduleRelativePath}`
    }
    const moduleKey = moduleRelativePath
      // Normalize to use forward slashes as modules are cached that way
      .replace(/\\/g, '/')
      .replace(/^\.\.\//, './')
    logTrace(
      'key "%s" for [ %s | %s ]',
      moduleKey,
      moduleRelativePath,
      moduleUri
    )

    return { moduleKey, moduleRelativePath }
  }
  return getModuleKey
}

export type SnapshotRequireOpts = {
  useCache?: boolean
  diagnostics?: boolean
  snapshotOverride?: Snapshot
  requireStatsFile?: string
  transpileOpts?: PackherdTranspileOpts
  alwaysHook?: boolean
}

const DEFAULT_SNAPSHOT_REQUIRE_OPTS = {
  useCache: true,
  diagnostics: false,
  alwaysHook: true,
}

function getCaches(sr: Snapshot | undefined, useCache: boolean) {
  if (typeof sr !== 'undefined') {
    return {
      moduleExports: useCache ? sr.customRequire.cache : undefined,
      moduleDefinitions: sr.customRequire.definitions,
    }
  } else {
    return { moduleExports: {}, moduleDefinitions: {} }
  }
}

function getSourceMapLookup() {
  // @ts-ignore global snapshotAuxiliaryData
  if (typeof snapshotAuxiliaryData === 'undefined')
    return (_: string) => undefined

  // @ts-ignore global snapshotAuxiliaryData
  const sourceMap = (<SnapshotAuxiliaryData>snapshotAuxiliaryData).sourceMap

  return (uri: string) => (uri === EMBEDDED ? sourceMap : undefined)
}

export function snapshotRequire(
  projectBaseDir: string,
  opts: SnapshotRequireOpts = {}
) {
  const { useCache, diagnostics, alwaysHook } = Object.assign(
    {},
    DEFAULT_SNAPSHOT_REQUIRE_OPTS,
    opts
  )
  const sr: Snapshot =
    opts.snapshotOverride ||
    // @ts-ignore global snapshotResult
    (typeof snapshotResult !== 'undefined' ? snapshotResult : undefined)

  if (sr != null || alwaysHook) {
    const { moduleExports, moduleDefinitions } = getCaches(sr, useCache)

    const cacheKeys = Object.keys(moduleExports || {})
    const defKeys = Object.keys(moduleDefinitions)
    logInfo(
      'Caching %d, defining %d modules! %s cache',
      cacheKeys.length,
      defKeys.length,
      useCache ? 'Using' : 'Not using'
    )

    logDebug('initializing packherd require')

    let resolverMap: Record<string, string> | undefined

    // @ts-ignore global snapshotAuxiliaryData
    if (typeof snapshotAuxiliaryData !== 'undefined') {
      // @ts-ignore global snapshotAuxiliaryData
      resolverMap = snapshotAuxiliaryData.resolverMap
    }

    const getModuleKey = createGetModuleKey(resolverMap)

    packherdRequire(projectBaseDir, {
      diagnostics,
      moduleExports,
      moduleDefinitions,
      getModuleKey,
      moduleMapper,
      requireStatsFile: opts.requireStatsFile,
      transpileOpts: opts.transpileOpts,
      sourceMapLookup: getSourceMapLookup(),
    })

    // @ts-ignore global snapshotResult
    if (typeof snapshotResult !== 'undefined') {
      const projectBaseDir = process.env.PROJECT_BASE_DIR
      if (projectBaseDir == null) {
        throw new Error(
          "Please provide the 'PROJECT_BASE_DIR' env var.\n" +
            'This is the same used when creating the snapshot.\n' +
            'Example: PROJECT_BASE_DIR=`pwd` yarn dev'
        )
      }

      const pathResolver = {
        resolve(p: string) {
          try {
            return path.resolve(projectBaseDir, p)
          } catch (err) {
            logError(err)
            debugger
          }
        },
      }

      // The below aren't available in all environments
      const checked_process: any =
        typeof process !== 'undefined' ? process : undefined
      const checked_window: any =
        typeof window !== 'undefined' ? window : undefined
      const checked_document: any =
        typeof document !== 'undefined' ? document : undefined

      // @ts-ignore global snapshotResult
      snapshotResult.setGlobals(
        global,
        checked_process,
        checked_window,
        checked_document,
        console,
        pathResolver,
        require
      )
    }
  }
}

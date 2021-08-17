import debug from 'debug'
import path from 'path'
import type {
  GetModuleKey,
  ModuleNeedsReload,
  PackherdTranspileOpts,
} from 'packherd'
import { packherdRequire } from 'packherd/dist/src/require.js'
import { moduleMapper } from './module_negotiator'
import { Snapshot, SnapshotAuxiliaryData } from '../types'
import { EMBEDDED } from '../constants'
import Module from 'module'
import { DependencyMap, DependencyMapArray } from '../meta/dependency-map'

const logInfo = debug('snapshot:info')
const logError = debug('snapshot:error')
const logDebug = debug('snapshot:debug')

const RESOLVER_MAP_KEY_SEP = '***'

function createGetModuleKey(resolverMap?: Record<string, string>) {
  const getModuleKey: GetModuleKey = ({ moduleUri, baseDir, opts }) => {
    // We can only reliably resolve modules without the Node.js machinery if we can find it in the
    // resolver map. For instance resolving `./util` involves probing the file system to resolve to
    // either `util.js`, `util.json` or possibly `util/index.js`
    // We could make an assumption that `./util.js` resolves to that file, but it could also refer
    // to `./util.js/index.js`
    // The same is true even if `path.isAbsolute` is given, i.e. `/Volumes/dev/util.js` could either be
    // a file or a directory, so we still couldn't be sure.
    if (resolverMap == null || opts == null) {
      return { moduleKey: undefined, moduleRelativePath: undefined }
    }

    const relParentDir = opts.relPath ?? path.relative(baseDir, opts.path)
    const resolverKey = `${relParentDir}${RESOLVER_MAP_KEY_SEP}${moduleUri}`

    const resolved = resolverMap[resolverKey]
    // Module cache prefixes with `./` while the resolver map doesn't
    if (resolved != null) {
      const moduleKey = `./${resolved}`
      return { moduleKey, moduleRelativePath: moduleKey }
    }

    return { moduleKey: undefined, moduleRelativePath: undefined }
  }
  return getModuleKey
}

function createModuleNeedsReload(
  dependencyMapArray: DependencyMapArray,
  projectBaseDir: string
) {
  const map = DependencyMap.fromDepArrayAndBaseDir(
    dependencyMapArray,
    projectBaseDir
  )

  const moduleNeedsReload: ModuleNeedsReload = (
    moduleId: string,
    loadedModules: Set<string>,
    moduleCache: Record<string, NodeModule>
  ) => {
    if (moduleCache[moduleId] != null) return false
    return (
      map.loadedButNotCached(moduleId, loadedModules, moduleCache) ||
      map.criticalDependencyLoadedButNotCached(
        moduleId,
        loadedModules,
        moduleCache
      )
    )
  }
  return moduleNeedsReload
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
      moduleExports: useCache ? sr.customRequire.exports : undefined,
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
    let moduleNeedsReload: ModuleNeedsReload | undefined

    // @ts-ignore global snapshotAuxiliaryData
    if (typeof snapshotAuxiliaryData !== 'undefined') {
      // @ts-ignore global snapshotAuxiliaryData
      resolverMap = snapshotAuxiliaryData.resolverMap
      const dependencyMapArray: DependencyMapArray =
        // @ts-ignore global snapshotAuxiliaryData
        snapshotAuxiliaryData.dependencyMapArray

      if (dependencyMapArray != null) {
        moduleNeedsReload = createModuleNeedsReload(
          dependencyMapArray,
          projectBaseDir
        )
      }
    }

    const getModuleKey = createGetModuleKey(resolverMap)

    const { resolve, shouldBypassCache, registerModuleLoad, tryLoad } =
      packherdRequire(projectBaseDir, {
        diagnostics,
        moduleExports,
        moduleDefinitions,
        getModuleKey,
        moduleMapper,
        requireStatsFile: opts.requireStatsFile,
        transpileOpts: opts.transpileOpts,
        sourceMapLookup: getSourceMapLookup(),
        moduleNeedsReload,
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

      // @ts-ignore private module var
      require.cache = Module._cache
      // @ts-ignore global snapshotResult
      snapshotResult.customRequire.cache = require.cache

      // @ts-ignore custom method on require
      require._tryLoad = tryLoad
      // @ts-ignore opts not exactly matching
      require.resolve = resolve
      // @ts-ignore custom method on require
      require.shouldBypassCache = shouldBypassCache
      // @ts-ignore custom method on require
      require.registerModuleLoad = registerModuleLoad
      // @ts-ignore custom property on require
      require.builtInModules = new Set(Module.builtinModules)
    }
  }
}

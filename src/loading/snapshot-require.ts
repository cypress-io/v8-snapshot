import debug from 'debug'
import type { GetModuleKey, PackherdTranspileOpts } from 'packherd'
import { packherdRequire } from 'packherd/dist/src/require.js'
import { moduleMapper } from './module_negotiator'
import path from 'path'
import { Snapshot } from '../types'

const logInfo = debug('snapshot:info')
const logDebug = debug('snapshot:debug')
const logTrace = debug('snapshot:trace')

const getModuleKey: GetModuleKey = (moduleUri, relPath) => {
  // TODO(thlorenz): this works for cases for which the root of the app
  // is up to one level below node_modules.
  // We need to investigate other cases.

  if (/^[a-zA-Z]/.test(relPath)) {
    // Change things like `node_modules/...` to `./node_modules/...`
    relPath = `./${relPath}`
  }
  const key = relPath.replace(/^\.\.\//, './')
  logTrace('key "%s" for [ %s | %s ]', key, relPath, moduleUri)
  return key
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

export function snapshotRequire(
  entryFile: string,
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
    const projectBaseDir = path.dirname(entryFile)
    packherdRequire(projectBaseDir, {
      diagnostics,
      moduleExports,
      moduleDefinitions,
      getModuleKey,
      moduleMapper,
      requireStatsFile: opts.requireStatsFile,
      transpileOpts: opts.transpileOpts,
    })

    // @ts-ignore global snapshotResult
    if (typeof snapshotResult !== 'undefined') {
      // The below aren't available in all environments
      const checked_process: any = typeof process !== 'undefined' ? process : {}
      const checked_window: any = typeof window !== 'undefined' ? window : {}
      const checked_document: any =
        typeof document !== 'undefined' ? document : {}

      // @ts-ignore global snapshotResult
      snapshotResult.setGlobals(
        global,
        checked_process,
        checked_window,
        checked_document,
        console,
        // TODO: was global.require which was `undefined`, how will this work for relative `require` calls?
        require
      )
    }
  }
}

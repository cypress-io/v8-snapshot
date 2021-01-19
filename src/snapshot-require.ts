import debug from 'debug'
import { SnapshotModuleLoader } from './snapshot-module-loader'

const logInfo = debug('snapshot:info')
const logDebug = debug('snapshot:debug')
const logTrace = debug('snapshot:trace')

export function snapshotRequire(projectBaseDir: string, diagnostics: boolean) {
  // @ts-ignore global snapshotResult
  if (typeof (snapshotResult as any) !== 'undefined') {
    // @ts-ignore global snapshotResult
    const sr = snapshotResult
    const cacheKeys = Object.keys(sr.customRequire.cache)
    const defKeys = Object.keys(sr.customRequire.definitions)
    logInfo(
      'snapshotResult available caching %d, defining %d modules!',
      cacheKeys.length,
      defKeys.length
    )
    logInfo({ projectBaseDir })

    const Module = require('module')
    const origLoad = Module._load

    const moduleLoader = new SnapshotModuleLoader(
      // @ts-ignore global snapshotResult
      snapshotResult,
      Module,
      origLoad,
      projectBaseDir,
      diagnostics
    )

    Module._load = function (
      moduleUri: string,
      parent: typeof Module,
      isMain: boolean
    ) {
      if (Module.builtinModules.includes(moduleUri)) {
        return origLoad(moduleUri, parent, isMain)
      }

      const {
        exports,
        origin,
        resolved,
        fullPath,
        relPath,
      } = moduleLoader.tryLoad(moduleUri, parent, isMain)

      switch (resolved) {
        case 'module': {
          logTrace(
            'Resolved "%s" via %s (%s | %s)',
            moduleUri,
            resolved,
            relPath,
            fullPath
          )
          break
        }
        case 'path': {
          logDebug(
            'Resolved "%s" via %s (%s | %s)',
            moduleUri,
            resolved,
            relPath,
            fullPath
          )
          break
        }
      }

      switch (origin) {
        case 'Module._load': {
          logDebug(
            'Loaded "%s" via %s resolved as (%s | %s)',
            moduleUri,
            origin,
            relPath,
            fullPath
          )
          break
        }
        case 'cache': {
          logTrace('Loaded "%s" via %s', moduleUri, origin)
          break
        }
        case 'definitions': {
          logTrace('Loaded "%s" via %s', moduleUri, origin)
          break
        }
      }

      return exports
    }

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

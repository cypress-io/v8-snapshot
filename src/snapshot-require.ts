import debug from 'debug'
import { packherdRequire } from 'packherd'

const logInfo = debug('snapshot:info')

export function snapshotRequire(entryFile: string, diagnostics: boolean) {
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
    packherdRequire(sr.customRequire.cache, entryFile, {
      diagnostics,
      exportsObjects: true,
    })

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

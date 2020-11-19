import path from 'path'

const coreModuleRx = /^[\w_-]+$/
const coreModuleCache = new Map()

export function snapshotRequire(projectBaseDir: string) {
  // @ts-ignore global snapshotResult
  if (typeof (snapshotResult as any) !== 'undefined') {
    // @ts-ignore global snapshotResult
    console.log('snapshotResult available!', snapshotResult)
    // @ts-ignore global snapshotResult
    console.log(Object.keys(snapshotResult.customRequire.cache))

    const Module = require('module')

    Module.prototype.require = function (moduleUri: string) {
      if (coreModuleRx.test(moduleUri)) {
        // Cached core modules only contain the absolute minimum like `util.inherits` in order
        // to avoid excluding modules just because they access small core functionality.
        // However once we are running we should load the core modules that come with the runtime.
        if (!coreModuleCache.has(moduleUri)) {
          console.log(
            'Loading core module "%s" into core module cache',
            moduleUri
          )
          let cachedModule = { exports: Module._load(moduleUri, this, false) }
          coreModuleCache.set(moduleUri, cachedModule)
          return cachedModule.exports
        } else {
          console.log('Core module cache hit:', moduleUri)
          return coreModuleCache.get(moduleUri)
        }
      } else {
        const absoluteFilePath = Module._resolveFilename(moduleUri, this, false)
        let relativeFilePath = path.relative(projectBaseDir, absoluteFilePath)
        if (!relativeFilePath.startsWith('./')) {
          relativeFilePath = `./${relativeFilePath}`
        }
        if (process.platform === 'win32') {
          relativeFilePath = relativeFilePath.replace(/\\/g, '/')
        }
        // @ts-ignore global snapshotResult
        let cachedModule = snapshotResult.customRequire.cache[relativeFilePath]
        // @ts-ignore global snapshotResult
        if (snapshotResult.customRequire.cache[relativeFilePath]) {
          console.log('Snapshot cache hit:', relativeFilePath)
        }
        if (!cachedModule) {
          console.log('Uncached module:', moduleUri, relativeFilePath)
          cachedModule = { exports: Module._load(moduleUri, this, false) }
          // @ts-ignore global snapshotResult
          snapshotResult.customRequire.cache[relativeFilePath] = cachedModule
        }
        return cachedModule.exports
      }
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
      global.require
    )
  }
}

import path from 'path'

export function snapshotRequire(projectBaseDir: string) {
  // @ts-ignore global snapshotResult
  if (typeof (snapshotResult as any) !== 'undefined') {
    // @ts-ignore global snapshotResult
    console.log('snapshotResult available!', snapshotResult)
    // @ts-ignore global snapshotResult
    console.log(Object.keys(snapshotResult.customRequire.cache))

    const Module = require('module')

    Module.prototype.require = function (moduleUri: string) {
      // Short circuit core modules to load them from the engine
      if (Module.builtinModules.includes(moduleUri)) {
        return Module._load(moduleUri, this, false)
      }

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

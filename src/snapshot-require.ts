import path from 'path'

export function snapshotRequire(packageJsonPath: string) {
  const projectBaseDir = path.dirname(packageJsonPath)
  // @ts-ignore global snapshotResult
  if (typeof (snapshotResult as any) !== 'undefined') {
    // @ts-ignore global snapshotResult
    console.log('snapshotResult available!', snapshotResult)

    const Module = require('module')

    // TODO(thlorenz): this may neeed some hardening
    Module.prototype.require = function (moduleUri: string) {
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

    // @ts-ignore global snapshotResult
    snapshotResult.setGlobals(
      global,
      process,
      window,
      document,
      console,
      global.require
    )
  }
}

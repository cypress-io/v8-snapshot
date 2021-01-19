import debug from 'debug'
import path from 'path'
import {
  ModuleBuildin,
  ModuleDefinition,
  ModuleLoadResult,
  ModuleResolveResult,
  SnapshotResult,
} from './types'

const logInfo = debug('snapshot:info')

export class SnapshotModuleLoader {
  private readonly _cache: Record<string, { exports: NodeModule['exports'] }>
  private readonly _definitions: Record<string, ModuleDefinition>

  cacheHits: number = 0
  definitionHits: number = 0
  misses: number = 0

  constructor(
    snapshotResult: SnapshotResult,
    private readonly Module: ModuleBuildin,
    private readonly origLoad: ModuleBuildin['_load'],
    private readonly projectBaseDir: string,
    private readonly diagnostics: boolean
  ) {
    this._cache = snapshotResult.customRequire.cache
    this._definitions = snapshotResult.customRequire.definitions
  }

  dumpInfo() {
    if (this.diagnostics) {
      logInfo({
        cacheHits: this.cacheHits,
        cacheKeys: this.definitionHits,
        misses: this.misses,
      })
    }
  }

  resolvePaths(
    moduleUri: string,
    parent: NodeModule,
    isMain: boolean
  ): ModuleResolveResult {
    let fullPath: string
    let relPath: string
    let resolved: ModuleResolveResult['resolved']
    try {
      fullPath = this.Module._resolveFilename(moduleUri, parent, isMain)
      resolved = 'module'
    } catch (err) {
      fullPath = path.resolve(this.projectBaseDir, moduleUri)
      resolved = 'path'
    }
    relPath = path.relative(this.projectBaseDir, fullPath)
    return { resolved, fullPath, relPath }
  }

  // TODO(thlorenz): if including diagnostics info ever becomes a perf issue we need to provide
  // an alternative method which doesn't create any extra objects
  tryLoad(
    moduleUri: string,
    parent: NodeModule,
    isMain: boolean
  ): ModuleLoadResult {
    let { resolved, relPath, fullPath } = this.resolvePaths(
      moduleUri,
      parent,
      isMain
    )
    const snapshotKey = `./${relPath}`

    // 1. try to resolve from snaphot cache
    const snapshotCached = this._cache[snapshotKey]
    if (snapshotCached != null) {
      const mod: NodeModule = {
        children: [],
        exports: snapshotCached.exports,
        filename: fullPath,
        id: fullPath,
        loaded: true,
        parent,
        path: fullPath,
        paths: parent.paths,
        require: this.Module.createRequire(fullPath),
      }
      this.cacheHits++
      this.Module._cache[fullPath] = mod
      this.dumpInfo()
      return {
        resolved,
        origin: 'cache',
        exports: mod.exports,
        fullPath,
        relPath,
      }
    }

    // 2. try to resolve a function that'll provide the module from the snapshot
    const snapshotDefined = this._definitions[snapshotKey]
    if (snapshotDefined != null) {
      const mod: NodeModule = {
        children: [],
        exports: {},
        filename: fullPath,
        id: fullPath,
        loaded: true,
        parent,
        path: fullPath,
        paths: parent.paths,
        require: this.Module.createRequire(fullPath),
      }
      snapshotDefined(
        mod.exports,
        mod,
        fullPath,
        path.dirname(fullPath),
        mod.require
      )
      this.definitionHits++
      this.Module._cache[fullPath] = mod
      this.dumpInfo()
      return {
        resolved,
        origin: 'definitions',
        exports: mod.exports,
        fullPath,
        relPath,
      }
    }

    // 3. If none of the above worked fall back to Node.js loader
    const exports = this.origLoad(moduleUri, parent, isMain)
    this.misses++
    this.dumpInfo()
    return { resolved, origin: 'Module._load', exports, fullPath, relPath }
  }
}

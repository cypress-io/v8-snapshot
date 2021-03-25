import { strict as assert } from 'assert'
import fs from 'fs'
import type { ModuleMapper } from 'packherd'
import path from 'path'

const EMBEDDED = '<embedded>:'
// This is the frame in the stack from which the bundled require will get called, however this may
// change in the future, i.e. when this library or any of its dependents like packherd change.
// For now we assume it doesn't too much and live with things being a bit brittle as
// otherwise we'd have to search for a range of stack frames which is much more
// costly.
// TODO(#1): add test to detect breakage when it occurs
const EMBEDDED_FRAMES = [10, 11]

const packName = require('../../package.json').name

export class ModuleNegotiator {
  private constructor(
    private readonly _projectBaseDir: string,
    private readonly _rootLevelDirs: string[]
  ) {}

  /*
   * Negotiates the correct moduleUri. In most cases it'll just return it unchanged.
   * In some cases it also modifies some `parent` properties in order to make
   * the Node.js module resolve mechanism work properly.
   */
  negotiate(parent: /* mut */ NodeModule, moduleUri: string): string {
    // NOTE: there are more cases of from inside bundle requires, i.e. relative resolves like
    // to `./hook-require` from `./ts/register'.
    // However this seems to be the only one and we want to skip loading that anyways since
    // we already hooked the require to get here.
    // The only way to _fix_ this more reliably would be to check the stack on each relative
    // require as well and since there are lots of those, that would affect performance.

    // NOTE: how we perform the cheap check first (accessing stack is expensive)
    if (this._maybeInRootDir(moduleUri) && this._requireInitiatedFromBundle()) {
      const fullModuleUri = path.resolve(this._projectBaseDir, moduleUri)
      return `./${path.relative(parent.path, fullModuleUri)}`
    }
    if (parent.id.includes(packName)) {
      const fakeOrigin = path.join(this._projectBaseDir, 'package.json')
      parent.id = parent.filename = fakeOrigin
      parent.path = path.dirname(fakeOrigin)
      parent.paths.unshift(path.join(parent.path, 'node_modules'))
    }
    return moduleUri
  }

  private _maybeInRootDir(moduleUri: string): boolean {
    if (!moduleUri.startsWith('./')) return false

    const dirs = path.dirname(moduleUri.slice(2)).split(path.sep)
    if (dirs.length === 0) return false

    return this._rootLevelDirs.includes(dirs[0])
  }

  private _requireInitiatedFromBundle(): boolean {
    const stack = new Error().stack!
    const frames = stack.split('\n')
    for (let frame of EMBEDDED_FRAMES) {
      if (frames.length <= frame) return false
      if (frames[frame].includes(EMBEDDED)) {
        return true
      }
    }
    return false
  }

  static _instance?: ModuleNegotiator
  static instance(projectBaseDir: string): ModuleNegotiator {
    if (ModuleNegotiator._instance != null) {
      assert(
        ModuleNegotiator._instance._projectBaseDir === projectBaseDir,
        'should not deal with different projects in same process'
      )
      return ModuleNegotiator._instance
    } else {
      ModuleNegotiator._instance = ModuleNegotiator.init(projectBaseDir)
      return ModuleNegotiator._instance
    }
  }

  static init(projectBaseDir: string) {
    const rootLevelDirs = fs.readdirSync(projectBaseDir).filter((x) => {
      const stat = fs.statSync(path.join(projectBaseDir, x))
      return stat.isDirectory()
    })
    return new ModuleNegotiator(projectBaseDir, rootLevelDirs)
  }
}

export const moduleMapper: ModuleMapper = (
  parent: NodeModule,
  moduleUri: string,
  projectBaseDir: string
) => {
  return ModuleNegotiator.instance(projectBaseDir).negotiate(parent, moduleUri)
}

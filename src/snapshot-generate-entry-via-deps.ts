import debug from 'debug'
import path from 'path'
import { promises as fs } from 'fs'
import { createBundle, CreateBundleOpts } from './create-snapshot-script'
import { Metadata } from './types'

const snapshotUtilsRoot = path.join(__dirname, '..')
const logInfo = debug('snapgen:info')
const logError = debug('snapgen:error')

class SnapshotEntryGeneratorViaWalk {
  constructor(
    readonly bundlerPath: string,
    readonly entryFile: string,
    readonly projectBaseDir: string,
    readonly fullPathToSnapshotEntry: string
  ) {}

  async createSnapshotScript() {
    const meta = await this._getMetadata()
    const paths = this._resolveRelativePaths(meta)
    return paths.map((x) => `exports['${x}'] = require('${x}')`).join('\n')
  }

  private _resolveRelativePaths(meta: Metadata) {
    const fullPaths = Object.values(meta.inputs)
      .map((x) => x.fileInfo.fullPath)
      .filter((x) => !x.startsWith(snapshotUtilsRoot))

    return fullPaths.map((x) => path.relative(this.fullPathToSnapshotEntry, x))
  }

  private async _getMetadata() {
    const opts: CreateBundleOpts = {
      bundlerPath: this.bundlerPath,
      baseDirPath: this.projectBaseDir,
      entryFilePath: this.entryFile,
    }
    const { meta } = await createBundle(opts)
    return meta
  }
}

export async function generateSnapshotEntryFromEntryDeps(
  bundlerPath: string,
  entryFile: string,
  projectBaseDir: string,
  fullPathToSnapshotEntry: string
) {
  const generator = new SnapshotEntryGeneratorViaWalk(
    bundlerPath,
    entryFile,
    projectBaseDir,
    fullPathToSnapshotEntry
  )
  try {
    const script = await generator.createSnapshotScript()

    logInfo(
      'Writing snapshot script (len: %s) to "%s"',
      script.length,
      fullPathToSnapshotEntry
    )

    await fs.writeFile(fullPathToSnapshotEntry, script, 'utf8')
  } catch (err) {
    logError(err)
  }
}

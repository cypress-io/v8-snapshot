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
    readonly fullPathToSnapshotEntry: string,
    readonly nodeModulesOnly: boolean
  ) {}

  async createSnapshotScript() {
    const meta = await this._getMetadata()
    const paths = this._resolveRelativePaths(meta)
    return paths.map((x) => `exports['${x}'] = require('${x}')`).join('\n')
  }

  private _resolveRelativePaths(meta: Metadata) {
    let fullPaths = Object.values(meta.inputs)
      .map((x) => x.fileInfo.fullPath)
      .filter((x) => !x.startsWith(snapshotUtilsRoot))

    if (this.nodeModulesOnly) {
      fullPaths = fullPaths.filter((x) => x.includes('node_modules'))
    }

    return fullPaths.map((x) =>
      path.relative(path.dirname(this.fullPathToSnapshotEntry), x)
    )
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

const DEFAULT_GENERATE_CONFIG: Partial<GenerateSnapshotEntryFromEntryDepsConfig> & {
  nodeModulesOnly: boolean
} = {
  nodeModulesOnly: true,
}

type GenerateSnapshotEntryFromEntryDepsConfig = {
  bundlerPath: string
  entryFile: string
  nodeModulesOnly?: boolean
}

export async function generateSnapshotEntryFromEntryDeps(
  projectBaseDir: string,
  fullPathToSnapshotEntry: string,
  config: GenerateSnapshotEntryFromEntryDepsConfig
) {
  const fullConf = Object.assign({}, DEFAULT_GENERATE_CONFIG, config)
  const generator = new SnapshotEntryGeneratorViaWalk(
    fullConf.bundlerPath,
    fullConf.entryFile,
    projectBaseDir,
    fullPathToSnapshotEntry,
    fullConf.nodeModulesOnly
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
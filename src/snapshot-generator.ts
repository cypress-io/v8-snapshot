// @ts-ignore
import electronLink from 'electron-link'
import debug from 'debug'
import { strict as assert } from 'assert'
import fs from 'fs'
import { join, dirname } from 'path'
import vm from 'vm'
import { execFileSync } from 'child_process'
import {
  ensureDirSync,
  checkFileSync,
  checkDirSync,
  findMksnapshot,
  eletronSnapshotPath,
  fileExistsSync,
} from './utils'

const logInfo = debug('snapgen:info')
const logDebug = debug('snapgen:debug')
const logError = debug('snapgen:error')

const SNAPSHOT_BACKUP = 'v8_context_snapshot.orig.bin'
const SNAPSHOT_BIN = 'v8_context_snapshot.bin'

export type ModuleFilter = (mp: {
  requiringModulePath: string
  requiredModulePath: string
}) => boolean

type GenerationOpts = {
  shouldExcludeModule: ModuleFilter
  verify: boolean
  minify: boolean
  cacheDir: string
  snapshotBinDir: string
  mksnapshotBin?: string
}

function getDefaultGenerationOpts(projectBaseDir: string): GenerationOpts {
  return {
    shouldExcludeModule: (_) => false,
    verify: true,
    minify: true,
    cacheDir: join(projectBaseDir, 'cache'),
    snapshotBinDir: projectBaseDir,
  }
}

export class SnapshotGenerator {
  readonly shouldExcludeModule: ModuleFilter
  readonly verify: boolean
  readonly minify: boolean
  readonly cacheDir: string
  readonly snapshotScriptPath: string
  readonly mksnapshotBin: string
  readonly snapshotBinDir: string
  snapshotScript?: string

  constructor(
    readonly projectBaseDir: string,
    readonly snapshotEntryFile: string,
    opts: Partial<GenerationOpts> = {}
  ) {
    const {
      shouldExcludeModule,
      verify,
      minify,
      cacheDir,
      snapshotBinDir,
    }: GenerationOpts = Object.assign(
      {},
      getDefaultGenerationOpts(projectBaseDir),
      opts
    )

    ensureDirSync(cacheDir)
    ensureDirSync(snapshotBinDir)

    this.shouldExcludeModule = shouldExcludeModule
    this.verify = verify
    this.minify = minify
    this.cacheDir = cacheDir
    this.snapshotBinDir = snapshotBinDir
    this.snapshotScriptPath = join(cacheDir, 'snapshot.js')

    if (opts.mksnapshotBin == null) {
      logDebug('No mksnapshot binary provided, attempting to find it')
      this.mksnapshotBin = findMksnapshot(projectBaseDir)
    } else {
      checkFileSync(opts.mksnapshotBin)
      this.mksnapshotBin = opts.mksnapshotBin
    }

    logInfo({
      projectBaseDir,
      cacheDir,
      snapshotBinDir,
      snapshotScriptPath: this.snapshotScriptPath,
      mksnapshotBin: this.mksnapshotBin,
      verify,
    })
  }

  async createScript() {
    let result
    try {
      result = await electronLink({
        baseDirPath: this.projectBaseDir,
        mainPath: this.snapshotEntryFile,
        cachePath: this.cacheDir,
        shouldExcludeModule: this._shouldExcludeModule,
      })
    } catch (err) {
      logError('Failed creating script with electron-link')
      throw err
    }
    logDebug(
      Object.assign({}, result, {
        snapshotScript: `len: ${result.snapshotScript.length}`,
      })
    )

    this.snapshotScript = result.snapshotScript

    if (this.verify) {
      logInfo('Verifying snapshot script')
      this._verifyScript()
    } else {
      logInfo('Skipping snapshot script verification')
    }
    logInfo(`Writing snapshot script to ${this.snapshotScriptPath}`)
    return fs.promises.writeFile(this.snapshotScriptPath, this.snapshotScript)
  }

  _shouldExcludeModule: ModuleFilter = ({
    requiringModulePath,
    requiredModulePath,
  }) => {
    return (
      /v8-snapshot-utils.dist.v8-snapshot-utils.js$/.test(requiredModulePath) ||
      this.shouldExcludeModule({
        requiringModulePath,
        requiredModulePath,
      })
    )
  }

  makeSnapshot() {
    assert(
      this.snapshotScript != null,
      'Run `createScript` first to create snapshotScript'
    )
    execFileSync(
      this.mksnapshotBin,
      [this.snapshotScriptPath, '--output_dir', this.snapshotBinDir],
      { stdio: 'pipe' }
    )
  }

  installSnapshot() {
    assert(
      this.snapshotScript != null,
      'Run `createScript` and `makeSnapshot` first to create snapshot'
    )
    const createdSnapshotBin = join(this.snapshotBinDir, SNAPSHOT_BIN)
    assert(
      fileExistsSync(createdSnapshotBin),
      'Run `makeSnapshot` first to create ' + createdSnapshotBin
    )

    const electronSnapshotBin = eletronSnapshotPath(this.projectBaseDir)
    const electronSnapshotDir = dirname(electronSnapshotBin)
    checkDirSync(electronSnapshotDir)

    const originalSnapshotBin = join(electronSnapshotDir, SNAPSHOT_BACKUP)

    if (!fileExistsSync(originalSnapshotBin)) {
      logInfo(
        `Backing up original electron snapshot to '${originalSnapshotBin}'`
      )
      assert(
        fileExistsSync(electronSnapshotBin),
        'cannot find original electron snapshot'
      )
      fs.copyFileSync(electronSnapshotBin, originalSnapshotBin)
    }
    logInfo(`Moving snapshot bin to '${electronSnapshotBin}'`)
    fs.renameSync(createdSnapshotBin, electronSnapshotBin)
  }

  private _verifyScript() {
    assert(this.snapshotScript != null, 'need snapshotScript to be set')
    vm.runInNewContext(this.snapshotScript, undefined, {
      filename: this.snapshotScriptPath,
      displayErrors: true,
    })
  }
}

export function uninstallSnapshot(projectBaseDir: string) {
  const electronSnapshotBin = eletronSnapshotPath(projectBaseDir)
  const electronSnapshotDir = dirname(electronSnapshotBin)
  checkDirSync(electronSnapshotDir)

  const originalSnapshotBin = join(electronSnapshotDir, SNAPSHOT_BACKUP)
  assert(
    fileExistsSync(originalSnapshotBin),
    'cannot find original electron snapshot'
  )
  fs.copyFileSync(originalSnapshotBin, electronSnapshotBin)

  logInfo(`Copying original snapshot bin to '${electronSnapshotBin}'`)
}

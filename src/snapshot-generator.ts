// @ts-ignore
import debug from 'debug'
import { strict as assert } from 'assert'
import fs from 'fs'
import { join, dirname } from 'path'
import vm from 'vm'
import { execFileSync } from 'child_process'
import { minify } from 'terser'
import {
  ensureDirSync,
  checkFileSync,
  checkDirSync,
  findMksnapshot,
  eletronSnapshotPath,
  fileExistsSync,
} from './utils'

import { createSnapshotScript } from './create-snapshot-script'

const logInfo = debug('snapgen:info')
const logDebug = debug('snapgen:debug')
const logError = debug('snapgen:error')

const SNAPSHOT_BACKUP = 'v8_context_snapshot.orig.bin'
const SNAPSHOT_BIN = 'v8_context_snapshot.bin'

type GenerationOpts = {
  verify: boolean
  minify: boolean
  skipWriteOnVerificationFailure: boolean
  cacheDir: string
  snapshotBinDir: string
  mksnapshotBin?: string
  auxiliaryData?: Record<string, any>
}

function getDefaultGenerationOpts(projectBaseDir: string): GenerationOpts {
  return {
    verify: true,
    minify: false,
    skipWriteOnVerificationFailure: false,
    cacheDir: join(projectBaseDir, 'cache'),
    snapshotBinDir: projectBaseDir,
  }
}

export class SnapshotGenerator {
  readonly verify: boolean
  readonly minify: boolean
  readonly skipWriteOnVerificationFailure: boolean
  readonly cacheDir: string
  readonly snapshotScriptPath: string
  readonly mksnapshotBin: string
  readonly snapshotBinDir: string
  readonly auxiliaryData?: Record<string, any>
  snapshotScript?: string

  constructor(
    readonly bundlerPath: string,
    readonly projectBaseDir: string,
    readonly snapshotEntryFile: string,
    opts: Partial<GenerationOpts> = {}
  ) {
    const {
      verify,
      minify,
      skipWriteOnVerificationFailure,
      cacheDir,
      snapshotBinDir,
    }: GenerationOpts = Object.assign(
      getDefaultGenerationOpts(projectBaseDir),
      opts
    )

    ensureDirSync(cacheDir)
    ensureDirSync(snapshotBinDir)

    this.verify = verify
    this.minify = minify
    this.skipWriteOnVerificationFailure = skipWriteOnVerificationFailure
    this.cacheDir = cacheDir
    this.snapshotBinDir = snapshotBinDir
    this.snapshotScriptPath = join(cacheDir, 'snapshot.js')
    this.auxiliaryData = opts.auxiliaryData

    if (opts.mksnapshotBin == null) {
      logDebug('No mksnapshot binary provided, attempting to find it')
      this.mksnapshotBin = findMksnapshot(projectBaseDir)
    } else {
      checkFileSync(opts.mksnapshotBin)
      this.mksnapshotBin = opts.mksnapshotBin
    }

    const auxiliaryDataKeys = Object.keys(this.auxiliaryData || {})
    logInfo({
      projectBaseDir,
      cacheDir,
      snapshotBinDir,
      snapshotScriptPath: this.snapshotScriptPath,
      mksnapshotBin: this.mksnapshotBin,
      auxiliaryData: auxiliaryDataKeys,
      verify,
    })
  }

  async createScript() {
    let result
    try {
      result = await createSnapshotScript({
        baseDirPath: this.projectBaseDir,
        entryFilePath: this.snapshotEntryFile,
        bundlerPath: this.bundlerPath,
        auxiliaryData: this.auxiliaryData,
      })
    } catch (err) {
      logError('Failed creating script')
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
      try {
        this._verifyScript()
      } catch (err) {
        if (!this.skipWriteOnVerificationFailure) {
          logInfo(
            `Script failed verification, writing to ${this.snapshotScriptPath}`
          )
          await fs.promises.writeFile(
            this.snapshotScriptPath,
            this.snapshotScript
          )
        }
        throw err
      }
    } else {
      logInfo('Skipping snapshot script verification')
    }
    logInfo(`Writing snapshot script to ${this.snapshotScriptPath}`)

    if (this.minify) {
      logInfo('Minifying snapshot script')
      const minified = await minify(this.snapshotScript!, { sourceMap: false })
      return fs.promises.writeFile(this.snapshotScriptPath, minified.code)
    }
    return fs.promises.writeFile(this.snapshotScriptPath, this.snapshotScript)
  }

  makeSnapshot() {
    assert(
      this.snapshotScript != null,
      'Run `createScript` first to create snapshotScript'
    )
    try {
      execFileSync(
        this.mksnapshotBin,
        [this.snapshotScriptPath, '--output_dir', this.snapshotBinDir],
        { stdio: ['pipe', 'pipe', 'inherit'] }
      )
    } catch (err) {
      if (err.stderr != null) {
        logError(err.stderr.toString())
      }
      if (err.stdout != null) {
        logDebug(err.stdout.toString())
      }
      throw new Error('Failed `mksnapshot` command')
    }
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

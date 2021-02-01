import { strict as assert } from 'assert'
import { execFileSync } from 'child_process'
import debug from 'debug'
import fs from 'fs'
import { dirname, join } from 'path'
import { minify } from 'terser'
import { createSnapshotScript } from './create-snapshot-script'
import { SnapshotVerifier } from './snapshot-verifier'
import { determineDeferred } from './determine-deferred'
import {
  checkDirSync,
  checkFileSync,
  electronSnapshotFilenames,
  electronSnapshotPath,
  ensureDirSync,
  fileExistsSync,
  findMksnapshot,
} from './utils'
import { createExportScript } from './create-snapshot-bundle'

const logInfo = debug('snapgen:info')
const logDebug = debug('snapgen:debug')
const logError = debug('snapgen:error')

const MK_SNAPSHOT_BIN_FILENAME = 'v8_context_snapshot.bin'

type GenerationOpts = {
  verify: boolean
  minify: boolean
  skipWriteOnVerificationFailure: boolean
  cacheDir: string
  snapshotBinDir: string
  includeHealthyOrphans: boolean
  nodeModulesOnly: boolean
  previousDeferred?: string[]
  previousHealthy?: string[]
  mksnapshotBin?: string
  auxiliaryData?: Record<string, any>
  norewrite?: string[]
  maxWorkers?: number
}

function getDefaultGenerationOpts(projectBaseDir: string): GenerationOpts {
  return {
    verify: true,
    minify: false,
    includeHealthyOrphans: false,
    skipWriteOnVerificationFailure: false,
    cacheDir: join(projectBaseDir, 'cache'),
    snapshotBinDir: projectBaseDir,
    nodeModulesOnly: true,
    previousDeferred: [],
    previousHealthy: [],
  }
}

export class SnapshotGenerator {
  private readonly verify: boolean
  private readonly minify: boolean
  private readonly includeHealthyOrphans: boolean
  private readonly skipWriteOnVerificationFailure: boolean
  private readonly cacheDir: string
  private readonly snapshotScriptPath: string
  private readonly snapshotExportScriptPath: string
  private readonly mksnapshotBin: string
  private readonly mksnapshotBinFilename: string
  private readonly snapshotBinDir: string
  private readonly snapshotBackupFilename: string
  private readonly auxiliaryData?: Record<string, any>
  private readonly norewrite: string[] | undefined
  private readonly nodeModulesOnly: boolean
  private readonly maxWorkers?: number
  private readonly previousDeferred: Set<string>
  private readonly previousHealthy: Set<string>
  private readonly _snapshotVerifier: SnapshotVerifier
  readonly snapshotBinFilename: string
  snapshotScript?: string
  snapshotExportScript?: string

  constructor(
    readonly bundlerPath: string,
    readonly projectBaseDir: string,
    readonly snapshotEntryFile: string,
    opts: Partial<GenerationOpts> = {}
  ) {
    const {
      verify,
      minify,
      includeHealthyOrphans,
      skipWriteOnVerificationFailure,
      cacheDir,
      snapshotBinDir,
      norewrite,
      maxWorkers,
      nodeModulesOnly,
      previousDeferred,
      previousHealthy,
    }: GenerationOpts = Object.assign(
      getDefaultGenerationOpts(projectBaseDir),
      opts
    )

    ensureDirSync(cacheDir)
    ensureDirSync(snapshotBinDir)

    this._snapshotVerifier = new SnapshotVerifier()
    this.verify = verify
    this.minify = minify
    this.norewrite = norewrite
    this.includeHealthyOrphans = includeHealthyOrphans
    this.skipWriteOnVerificationFailure = skipWriteOnVerificationFailure
    this.cacheDir = cacheDir
    this.snapshotBinDir = snapshotBinDir
    this.snapshotScriptPath = join(cacheDir, 'snapshot.js')
    this.snapshotExportScriptPath = join(cacheDir, 'snapshot-bundle.js')
    this.auxiliaryData = opts.auxiliaryData
    this.nodeModulesOnly = nodeModulesOnly
    this.previousDeferred = new Set(previousDeferred)
    this.previousHealthy = new Set(previousHealthy)
    this.maxWorkers = maxWorkers

    const { snapshotBin, snapshotBackup } = electronSnapshotFilenames(
      projectBaseDir
    )
    this.snapshotBinFilename = snapshotBin
    this.snapshotBackupFilename = snapshotBackup
    this.mksnapshotBinFilename = MK_SNAPSHOT_BIN_FILENAME

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
    let deferred
    let healthyOrphans
    try {
      ;({ deferred, healthyOrphans } = await determineDeferred(
        this.bundlerPath,
        this.projectBaseDir,
        this.snapshotEntryFile,
        this.cacheDir,
        this.includeHealthyOrphans,
        {
          maxWorkers: this.maxWorkers,
          nodeModulesOnly: this.nodeModulesOnly,
          previousDeferred: this.previousDeferred,
          previousHealthy: this.previousHealthy,
        }
      ))
    } catch (err) {
      logError('Failed obtaining deferred modules to create script')
      throw err
    }

    let result
    try {
      result = await createSnapshotScript({
        baseDirPath: this.projectBaseDir,
        entryFilePath: this.snapshotEntryFile,
        bundlerPath: this.bundlerPath,
        includeStrictVerifiers: false,
        deferred,
        norewrite: this.norewrite,
        orphansToInclude: this.includeHealthyOrphans ? healthyOrphans : null,
        auxiliaryData: this.auxiliaryData,
        nodeModulesOnly: this.nodeModulesOnly,
      })
    } catch (err) {
      logError('Failed creating script')
      throw err
    }
    logDebug(
      Object.assign({}, result, {
        snapshotScript: `len: ${result.snapshotScript.length}`,
        bundle: `len: ${result.bundle.length}`,
        meta: '<hidden>',
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

  async createExportBundle() {
    let deferred
    let healthyOrphans
    try {
      ;({ deferred, healthyOrphans } = await determineDeferred(
        this.bundlerPath,
        this.projectBaseDir,
        this.snapshotEntryFile,
        this.cacheDir,
        this.includeHealthyOrphans,
        {
          maxWorkers: this.maxWorkers,
          nodeModulesOnly: this.nodeModulesOnly,
          previousDeferred: this.previousDeferred,
          previousHealthy: this.previousHealthy,
        }
      ))
    } catch (err) {
      logError('Failed obtaining deferred modules to create script')
      throw err
    }

    let result
    try {
      result = await createExportScript({
        baseDirPath: this.projectBaseDir,
        entryFilePath: this.snapshotEntryFile,
        bundlerPath: this.bundlerPath,
        includeStrictVerifiers: false,
        deferred,
        norewrite: this.norewrite,
        nodeModulesOnly: this.nodeModulesOnly,
        orphansToInclude: this.includeHealthyOrphans ? healthyOrphans : null,
        auxiliaryData: this.auxiliaryData,
      })
    } catch (err) {
      logError('Failed creating script')
      throw err
    }
    logDebug(
      Object.assign({}, result, {
        snapshotBundle: `len: ${result.snapshotBundle.length}`,
        bundle: `len: ${result.bundle.length}`,
        meta: '<hidden>',
      })
    )

    this.snapshotExportScript = result.snapshotBundle

    logInfo(`Writing export bundle script to ${this.snapshotExportScriptPath}`)
    return fs.promises.writeFile(
      this.snapshotExportScriptPath,
      this.snapshotExportScript
    )
  }

  makeSnapshot() {
    assert(
      this.snapshotScript != null,
      'Run `createScript` first to create snapshotScript'
    )
    const args = [this.snapshotScriptPath, '--output_dir', this.snapshotBinDir]
    const cmd = `node ${this.mksnapshotBin} ${args.join(' ')}`
    logDebug(cmd)
    try {
      execFileSync(this.mksnapshotBin, args)
      const createdSnapshotBin = join(
        this.snapshotBinDir,
        this.mksnapshotBinFilename
      )
      if (!fileExistsSync(createdSnapshotBin)) {
        logError(
          `Cannot find ${createdSnapshotBin} which should've been created.\n` +
            `This could be due to the mksnapshot command silently failing. Run:\n   ${cmd}\n` +
            `to verify this.`
        )
        return false
      }
      return true
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
    const createdSnapshotBin = join(
      this.snapshotBinDir,
      this.mksnapshotBinFilename
    )
    assert(
      fileExistsSync(createdSnapshotBin),
      'Run `makeSnapshot` first to create ' + createdSnapshotBin
    )

    const electronSnapshotBin = electronSnapshotPath(this.projectBaseDir)
    const electronSnapshotDir = dirname(electronSnapshotBin)
    checkDirSync(electronSnapshotDir)

    const originalSnapshotBin = join(
      electronSnapshotDir,
      this.snapshotBackupFilename
    )

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

  makeAndInstallSnapshot() {
    if (this.makeSnapshot()) {
      this.installSnapshot()
    } else {
      throw new Error('make snapshot failed')
    }
  }

  private _verifyScript() {
    assert(this.snapshotScript != null, 'need snapshotScript to be set')
    this._snapshotVerifier.verify(this.snapshotScript, this.snapshotScriptPath)
  }
}

export function uninstallSnapshot(projectBaseDir: string) {
  const electronSnapshotBin = electronSnapshotPath(projectBaseDir)
  const electronSnapshotDir = dirname(electronSnapshotBin)
  checkDirSync(electronSnapshotDir)

  const { snapshotBackup } = electronSnapshotFilenames(projectBaseDir)
  const originalSnapshotBin = join(electronSnapshotDir, snapshotBackup)

  assert(
    fileExistsSync(originalSnapshotBin),
    'cannot find original electron snapshot'
  )
  fs.copyFileSync(originalSnapshotBin, electronSnapshotBin)

  logInfo(`Copying original snapshot bin to '${electronSnapshotBin}'`)
}

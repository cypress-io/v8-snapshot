import { strict as assert } from 'assert'
import debug from 'debug'
import fs from 'fs'
import { dirname, join, basename } from 'path'
import { minify } from 'terser'
import { createSnapshotScript } from './create-snapshot-script'
import { SnapshotVerifier } from './snapshot-verifier'
import { determineDeferred } from './doctor/determine-deferred'
import {
  backupName,
  checkDirSync,
  installedElectronResourcesFilePath,
  ensureDirSync,
  fileExistsSync,
  getBundlerPath,
  resolveElectronVersion,
} from './utils'
import { createExportScript } from './create-snapshot-bundle'
import { Flag, GeneratorFlags } from './snapshot-generator-flags'
import { syncAndRun, getMetadata } from '@thlorenz/electron-mksnapshot'

const logInfo = debug('snapgen:info')
const logDebug = debug('snapgen:debug')
const logError = debug('snapgen:error')

type GenerationOpts = {
  verify: boolean
  minify: boolean
  skipWriteOnVerificationFailure: boolean
  cacheDir: string
  snapshotBinDir: string
  nodeModulesOnly: boolean
  sourcemapEmbed: boolean
  sourcemapInline: boolean
  includeStrictVerifiers: boolean
  previousHealthy?: string[]
  previousDeferred?: string[]
  previousNoRewrite?: string[]
  forceNoRewrite?: string[]
  resolverMap?: Record<string, string>
  auxiliaryData?: Record<string, any>
  electronVersion?: string
  maxWorkers?: number
  flags: Flag
  nodeEnv: string
}

function getDefaultGenerationOpts(projectBaseDir: string): GenerationOpts {
  return {
    verify: true,
    minify: false,
    skipWriteOnVerificationFailure: false,
    cacheDir: join(projectBaseDir, 'cache'),
    snapshotBinDir: projectBaseDir,
    nodeModulesOnly: true,
    sourcemapEmbed: false,
    sourcemapInline: false,
    includeStrictVerifiers: false,
    previousDeferred: [],
    previousHealthy: [],
    flags: Flag.Script | Flag.MakeSnapshot | Flag.ReuseDoctorArtifacts,
    nodeEnv: 'development',
  }
}

export class SnapshotGenerator {
  private readonly verify: boolean
  private readonly minify: boolean
  private readonly skipWriteOnVerificationFailure: boolean
  private readonly cacheDir: string
  private readonly snapshotScriptPath: string
  private readonly snapshotExportScriptPath: string
  private readonly snapshotBinDir: string
  private readonly resolverMap?: Record<string, string>
  private readonly auxiliaryData?: Record<string, any>
  private readonly electronVersion: string
  private readonly nodeModulesOnly: boolean
  private readonly sourcemapEmbed: boolean
  private readonly sourcemapInline: boolean
  private readonly includeStrictVerifiers: boolean
  private readonly maxWorkers?: number
  private readonly previousDeferred: Set<string>
  private readonly previousHealthy: Set<string>
  private readonly previousNoRewrite: Set<string>
  private readonly forceNoRewrite: Set<string>
  private readonly nodeEnv: string
  private readonly bundlerPath: string
  private readonly _snapshotVerifier: SnapshotVerifier
  private readonly _flags: GeneratorFlags

  private snapshotBinPath?: string
  private v8ContextFile?: string

  snapshotScript?: Buffer
  snapshotExportScript?: string

  constructor(
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
      maxWorkers,
      nodeModulesOnly,
      sourcemapEmbed,
      sourcemapInline,
      includeStrictVerifiers,
      previousDeferred,
      previousHealthy,
      previousNoRewrite,
      forceNoRewrite,
      flags: mode,
      nodeEnv,
      electronVersion,
    }: GenerationOpts = Object.assign(
      getDefaultGenerationOpts(projectBaseDir),
      opts
    )

    ensureDirSync(cacheDir)
    ensureDirSync(snapshotBinDir)

    this._snapshotVerifier = new SnapshotVerifier()
    this.verify = verify
    this.minify = minify
    this.skipWriteOnVerificationFailure = skipWriteOnVerificationFailure
    this.cacheDir = cacheDir
    this.snapshotBinDir = snapshotBinDir
    this.snapshotScriptPath = join(cacheDir, 'snapshot.js')
    this.snapshotExportScriptPath = join(cacheDir, 'snapshot-bundle.js')
    this.auxiliaryData = opts.auxiliaryData
    this.resolverMap = opts.resolverMap
    this.electronVersion =
      electronVersion ?? resolveElectronVersion(projectBaseDir)
    this.nodeModulesOnly = nodeModulesOnly
    this.sourcemapEmbed = sourcemapEmbed
    this.sourcemapInline = sourcemapInline
    this.includeStrictVerifiers = includeStrictVerifiers
    this.previousDeferred = new Set(previousDeferred)
    this.previousHealthy = new Set(previousHealthy)
    this.previousNoRewrite = new Set(previousNoRewrite)
    this.forceNoRewrite = new Set(forceNoRewrite)
    this.maxWorkers = maxWorkers
    this.nodeEnv = nodeEnv
    this._flags = new GeneratorFlags(mode)
    this.bundlerPath = getBundlerPath()

    const auxiliaryDataKeys = Object.keys(this.auxiliaryData || {})
    logInfo({
      projectBaseDir,
      cacheDir,
      snapshotBinDir,
      snapshotScriptPath: this.snapshotScriptPath,
      nodeModulesOnly: this.nodeModulesOnly,
      sourcemapEmbed: this.sourcemapEmbed,
      sourcemapInline: this.sourcemapInline,
      includeStrictVerifiers: this.includeStrictVerifiers,
      previousDeferred: this.previousDeferred.size,
      previousHealthy: this.previousHealthy.size,
      previousNoRewrite: this.previousNoRewrite.size,
      forceNoRewrite: this.forceNoRewrite.size,
      auxiliaryData: auxiliaryDataKeys,
      verify,
    })
  }

  async createScript() {
    let deferred
    let norewrite
    try {
      ;({ deferred, norewrite } = await determineDeferred(
        this.bundlerPath,
        this.projectBaseDir,
        this.snapshotEntryFile,
        this.cacheDir,
        {
          maxWorkers: this.maxWorkers,
          nodeModulesOnly: this.nodeModulesOnly,
          previousDeferred: this.previousDeferred,
          previousHealthy: this.previousHealthy,
          previousNoRewrite: this.previousNoRewrite,
          forceNoRewrite: this.forceNoRewrite,
          useHashBasedCache: this._flags.has(Flag.ReuseDoctorArtifacts),
          nodeEnv: this.nodeEnv,
        }
      ))
    } catch (err) {
      logError('Failed obtaining deferred modules to create script')
      throw err
    }

    let result
    const sourcemapExternalPath = `${this.snapshotScriptPath}.map`
    try {
      result = await createSnapshotScript({
        baseDirPath: this.projectBaseDir,
        entryFilePath: this.snapshotEntryFile,
        bundlerPath: this.bundlerPath,
        includeStrictVerifiers: false,
        deferred,
        norewrite,
        resolverMap: this.resolverMap,
        auxiliaryData: this.auxiliaryData,
        nodeModulesOnly: this.nodeModulesOnly,
        sourcemapEmbed: this.sourcemapEmbed,
        sourcemapInline: this.sourcemapInline,
        sourcemap: true,
        sourcemapExternalPath,
        nodeEnv: this.nodeEnv,
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
      const minified = await minify(this.snapshotScript!.toString(), {
        sourceMap: false,
      })
      assert(minified.code != null, 'Should return minified code')
      return fs.promises.writeFile(this.snapshotScriptPath, minified.code)
    }
    return fs.promises.writeFile(this.snapshotScriptPath, this.snapshotScript)
  }

  async createExportBundle() {
    let deferred
    let norewrite
    try {
      ;({ deferred, norewrite } = await determineDeferred(
        this.bundlerPath,
        this.projectBaseDir,
        this.snapshotEntryFile,
        this.cacheDir,
        {
          maxWorkers: this.maxWorkers,
          nodeModulesOnly: this.nodeModulesOnly,
          previousHealthy: this.previousHealthy,
          previousDeferred: this.previousDeferred,
          previousNoRewrite: this.previousNoRewrite,
          forceNoRewrite: this.forceNoRewrite,
          useHashBasedCache: this._flags.has(Flag.ReuseDoctorArtifacts),
          nodeEnv: this.nodeEnv,
        }
      ))
    } catch (err) {
      logError('Failed obtaining deferred modules to create script')
      throw err
    }

    logInfo('determined deferred %o', { deferred, norewrite })

    let result
    try {
      result = await createExportScript({
        baseDirPath: this.projectBaseDir,
        entryFilePath: this.snapshotEntryFile,
        bundlerPath: this.bundlerPath,
        includeStrictVerifiers: this.includeStrictVerifiers,
        deferred,
        norewrite,
        nodeModulesOnly: this.nodeModulesOnly,
        sourcemapEmbed: false,
        sourcemapInline: false,
        sourcemap: false,
        resolverMap: this.resolverMap,
        auxiliaryData: this.auxiliaryData,
        nodeEnv: this.nodeEnv,
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

  async makeSnapshot() {
    function runInstructions() {
      const bin = require.resolve('@thlorenz/mksnapshot/dist/mksnapshot-bin')
      const cmd = `node ${bin} ${args.join(' ')}`
      logError(`Run:\n   ${cmd}\n to investigate.`)
    }
    assert(
      this.snapshotScript != null,
      'Run `createScript` first to create snapshotScript'
    )
    assert(
      this._flags.has(Flag.MakeSnapshot),
      'Cannot makeSnapshot when MakeSnapshot flag is not set'
    )
    const args = [this.snapshotScriptPath, '--output_dir', this.snapshotBinDir]
    try {
      const { snapshotBlobFile, v8ContextFile } = await syncAndRun(
        this.electronVersion,
        args
      )
      this.v8ContextFile = v8ContextFile
      this.snapshotBinPath = join(this.snapshotBinDir, snapshotBlobFile)

      if (!fileExistsSync(this.snapshotBinPath)) {
        logError(
          `Cannot find ${this.snapshotBinPath} which should've been created.\n` +
            `This could be due to the mksnapshot command silently failing.`
        )
        runInstructions()
        return null
      }
      return { v8ContextFile: this.v8ContextFile! }
    } catch (err: any) {
      if (err.stderr != null) {
        logError(err.stderr.toString())
      }
      if (err.stdout != null) {
        logDebug(err.stdout.toString())
      }
      runInstructions()
      throw new Error('Failed `mksnapshot` command')
    }
  }

  installSnapshot() {
    assert(
      this.snapshotScript != null,
      'Run `createScript` and `makeSnapshot` first to create snapshot'
    )
    assert(
      this._flags.has(Flag.MakeSnapshot),
      'Cannot install when MakeSnapshot flag is not set'
    )
    assert(
      this.snapshotBinPath != null && fileExistsSync(this.snapshotBinPath),
      'Run `makeSnapshot` first to create snapshot bin file ' +
        this.snapshotBinPath
    )
    assert(
      this.v8ContextFile != null,
      'mksnapshot ran but v8ContextFile was not set'
    )

    const electronV8ContextBin = installedElectronResourcesFilePath(
      this.projectBaseDir,
      this.v8ContextFile
    )
    const electronResourcesDir = dirname(electronV8ContextBin)
    checkDirSync(electronResourcesDir)

    const v8ContextBackupName = backupName(this.v8ContextFile)
    const originalV8ContextBin = join(electronResourcesDir, v8ContextBackupName)

    if (!fileExistsSync(originalV8ContextBin)) {
      logInfo(
        `Backing up original electron v8-context to '${originalV8ContextBin}'`
      )
      assert(
        fileExistsSync(electronV8ContextBin),
        'cannot find original electron snapshot'
      )
      fs.copyFileSync(electronV8ContextBin, originalV8ContextBin)
    }
    const v8ContextFullPath = join(this.projectBaseDir, this.v8ContextFile)
    logInfo(`Moving ${this.v8ContextFile} to '${electronV8ContextBin}'`)
    fs.renameSync(v8ContextFullPath, electronV8ContextBin)

    const snapshotBinFile = basename(this.snapshotBinPath)
    const electronSnapshotBin = join(electronResourcesDir, snapshotBinFile)

    logInfo(`Moving ${snapshotBinFile} to ${electronSnapshotBin}`)
    fs.renameSync(this.snapshotBinPath, electronSnapshotBin)
  }

  async makeAndInstallSnapshot() {
    const res = await this.makeSnapshot()
    if (res != null) {
      this.installSnapshot()
      return res
    } else {
      throw new Error('make snapshot failed')
    }
  }

  private _verifyScript() {
    assert(this.snapshotScript != null, 'need snapshotScript to be set')
    this._snapshotVerifier.verify(this.snapshotScript, this.snapshotScriptPath)
  }
}

export function uninstallSnapshot(projectBaseDir: string, version?: string) {
  version = version ?? resolveElectronVersion(projectBaseDir)
  const { v8ContextFile } = getMetadata(version)

  const electronSnapshotBin = installedElectronResourcesFilePath(
    projectBaseDir,
    v8ContextFile
  )
  const electronSnapshotDir = dirname(electronSnapshotBin)
  checkDirSync(electronSnapshotDir)

  const snapshotBackup = backupName(v8ContextFile)
  const originalSnapshotBin = join(electronSnapshotDir, snapshotBackup)

  assert(
    fileExistsSync(originalSnapshotBin),
    'cannot find original electron snapshot'
  )
  fs.copyFileSync(originalSnapshotBin, electronSnapshotBin)

  logInfo(`Copying original snapshot bin to '${electronSnapshotBin}'`)
}

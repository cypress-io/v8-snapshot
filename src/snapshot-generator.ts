// @ts-ignore
import electronLink from 'electron-link'
import debug from 'debug'
import { strict as assert } from 'assert'
import fs from 'fs'
import { join, resolve } from 'path'
import vm from 'vm'
import { execFileSync } from 'child_process'

const logInfo = debug('snapgen:info')
const logDebug = debug('snapgen:debug')
const logError = debug('snapgen:error')

function canAccessSync(p: string) {
  try {
    fs.accessSync(p)
    return true
  } catch (_) {
    return false
  }
}

function ensureDirSync(dir: string) {
  if (!canAccessSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    return
  }
  // dir already exists, make sure it isn't a file
  const stat = fs.statSync(dir)
  if (!stat.isDirectory()) {
    throw new Error(`'${dir}' is not a directory`)
  }
}

function checkBinary(p: string) {
  if (!canAccessSync(p)) throw new Error(`Unable to find '${p}'`)
  const stat = fs.statSync(p)
  if (!stat.isFile()) throw new Error(`${p} is no executable file`)
}

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

function findMksnapshot(root: string) {
  const p = resolve(
    root,
    'node_modules',
    '.bin',
    'mksnapshot' + (process.platform === 'win32' ? '.cmd' : '')
  )
  checkBinary(p)
  return p
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
      checkBinary(opts.mksnapshotBin)
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
        shouldExcludeModule: this.shouldExcludeModule,
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
    // TODO:
  }

  private _verifyScript() {
    assert(this.snapshotScript != null, 'need snapshotScript to be set')
    vm.runInNewContext(this.snapshotScript, undefined, {
      filename: this.snapshotScriptPath,
      displayErrors: true,
    })
  }
}

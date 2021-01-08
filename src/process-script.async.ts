import debug from 'debug'
import os from 'os'
import WorkerNodes from 'worker-nodes'
import { CreateSnapshotScriptOpts } from './create-snapshot-script'
import {
  BundleAndProcessScriptResult,
  ProcessScriptOpts,
  ProcessScriptResult,
} from './types'

const workerScript = require.resolve('./process-script.worker')

const logInfo = debug('snapgen:info')
const logDebug = debug('snapgen:debug')

export class AsyncScriptProcessor {
  private readonly _workers: WorkerNodesInstance
  constructor() {
    logInfo('Initializing async script processor')
    const maxWorkers = os.cpus().length
    const minWorkers = maxWorkers / 2

    const opts = {
      autoStart: true,
      lazyStart: false,
      minWorkers,
      maxWorkers,
      maxTasksPerWorker: 1,
      taskMaxRetries: 0,
    }

    this._workers = new WorkerNodes(workerScript, opts)
  }

  async createAndProcessScript(
    opts: CreateSnapshotScriptOpts,
    entryPoint: string
  ): Promise<BundleAndProcessScriptResult> {
    return this._workers.call.createAndProcessScript(opts, entryPoint)
  }

  async processScript(opts: ProcessScriptOpts): Promise<ProcessScriptResult> {
    // don't send large strings across
    opts.bundle = undefined
    return this._workers.call.processScript(opts)
  }

  async dispose() {
    const result = await this._workers.terminate()
    logDebug(result)
    return
  }
}

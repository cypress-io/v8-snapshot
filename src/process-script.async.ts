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

type AsyncScriptProcessorOpts = {
  maxWorkers?: number
}

const DEFAULT_ASYNC_SCRIPT_PROCESSOR_OPTS = {
  maxWorkers: os.cpus().length,
}

export class AsyncScriptProcessor {
  private readonly _workers: WorkerNodesInstance
  constructor(args: AsyncScriptProcessorOpts) {
    logInfo('Initializing async script processor')
    const processorOpts = Object.assign(
      {},
      DEFAULT_ASYNC_SCRIPT_PROCESSOR_OPTS,
      args
    )
    const { maxWorkers } = processorOpts
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

  createAndProcessScript(
    opts: CreateSnapshotScriptOpts,
    entryPoint: string
  ): Promise<BundleAndProcessScriptResult> {
    return this._workers.call.createAndProcessScript(opts, entryPoint)
  }

  async processScript(opts: ProcessScriptOpts): Promise<ProcessScriptResult> {
    // TODO(thlorenz): here we previously removed the bundle as we were worried
    // about sending large strings across the wire.
    // We used a hash to determine if the worker needed to load the bundle from the
    // file system or not.
    // If this becomes a bottleneck we should have the doctor write the file to disk
    // and attach the bundle path. Then iff it is set we remove the bundle and thus
    // the worker will know that it has to read the file instead and proceed as previously
    // WRT to hashing.
    return this._workers.call.processScript(opts)
  }

  async dispose() {
    const result = await this._workers.terminate()
    logDebug(result)
    return
  }
}

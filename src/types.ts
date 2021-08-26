import type { CreateBundleResult } from 'packherd'
import { RawSourceMap } from 'source-map-js'

type NodeRequireFunction = typeof require

export type Entries<T> = {
  [K in keyof T]: [K, T[K]]
}[keyof T][]

export type Metadata = CreateBundleResult['metafile'] & {
  inputs: Record<
    string,
    {
      bytes: number
      fileInfo: {
        fullPath: string
      }
      imports: {
        path: string
        kind: 'require-call'
      }[]
    }
  >
  resolverMap: Record<string, string>
}

export type CreateBundleOpts = {
  baseDirPath: string
  entryFilePath: string
  bundlerPath: string
  nodeModulesOnly: boolean
  deferred?: string[]
  norewrite?: string[]
  includeStrictVerifiers?: boolean
  sourcemap?: boolean
  sourcemapExternalPath?: string
  sourcemapEmbed: boolean
  sourcemapInline: boolean
}

export type CreateSnapshotScriptOpts = CreateBundleOpts & {
  resolverMap?: Record<string, string>
  auxiliaryData?: Record<string, any>
  nodeEnv: string
}

export type ProcessScriptOpts = {
  bundleHash: string
  bundlePath: string

  baseDirPath: string
  entryFilePath: string
  entryPoint: string

  nodeEnv: string
}

export type ProcessScriptResult = {
  outcome: 'failed:assembleScript' | 'failed:verifyScript' | 'completed'
  error?: Error
}
export type BundleAndProcessScriptResult = {
  outcome: 'failed:bundleScript' | ProcessScriptResult['outcome']
  error?: Error
}

export type ModuleDefinition = (
  exports: NodeModule['exports'],
  module: { exports: NodeModule['exports'] },
  __filename: string,
  __dirname: string,
  require: NodeRequireFunction
) => NodeModule

export type SnapshotResult = {
  customRequire: {
    cache: Record<string, NodeModule>
    definitions: Record<string, ModuleDefinition>
  }
}

export type Snapshot = {
  customRequire: {
    definitions: Record<string, NodeRequireFunction>
    exports: Record<string, NodeModule>
    // Module._cache === require.cache
    cache: Record<string, NodeModule>
  }
}

export type SnapshotAuxiliaryData = {
  sourceMap?: RawSourceMap
}

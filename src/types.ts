export type Entries<T> = {
  [K in keyof T]: [K, T[K]]
}[keyof T][]

export type Metadata = {
  inputs: Record<
    string,
    {
      bytes: number
      fileInfo: {
        fullPath: string
      }
      imports: { path: string }[]
    }
  >
}

export type ProcessScriptOpts = {
  bundle?: string
  bundleHash?: string
  bundlePath?: string
  baseDirPath: string
  entryFilePath: string
  entryPoint: string
}

export type ProcessScriptResult = {
  outcome: 'failed:assembleScript' | 'failed:verifyScript' | 'completed'
  error?: Error
}
export type BundleAndProcessScriptResult = {
  outcome: 'failed:bundleScript' | ProcessScriptResult['outcome']
  error?: Error
}

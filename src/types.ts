export type Entries<T> = {
  [K in keyof T]: [K, T[K]]
}[keyof T][]

export type Metadata = {
  inputs: Record<string, { bytes: number; imports: { path: string }[] }>
  outputs: Record<
    string,
    {
      inputs: Record<
        string,
        {
          bytesInOutput: number
          fileInfo: {
            identifierName: string
            fullPath: string
            isEntryPoint: boolean
            replacementFunction: string
          }
        }
      >
      bytes: number
    }
  >
}

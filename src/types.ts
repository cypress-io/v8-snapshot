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

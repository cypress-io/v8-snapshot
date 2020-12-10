import { Metadata, Entries } from './types'

export function circularImports(
  inputs: Metadata['inputs'],
  entries: Entries<Metadata['inputs']>
) {
  const map: Map<string, Set<string>> = new Map()
  for (const [key, { imports }] of entries) {
    const circs = []
    for (const p of imports.map((x) => x.path)) {
      const isCircular = inputs[p].imports.some((x) => x.path === key)
      if (isCircular) circs.push(p)
    }
    if (circs.length > 0) map.set(key, new Set(circs))
  }
  return map
}

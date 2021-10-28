import path from 'path'
import { Metadata } from 'src/types'
import { strict as assert } from 'assert'

type DependencyNode = { directDeps: Set<string>; allDeps: Set<string> }

export function buildDependencyMap(inputs: Metadata['inputs']) {
  const dependencyMap: Map<string, DependencyNode> = new Map()

  for (const key of Object.keys(inputs)) {
    const imports = inputs[key].imports.map((x) => x.path)
    dependencyMap.set(key, {
      directDeps: new Set(imports),
      allDeps: new Set(imports),
    })
  }

  for (const [id, node] of dependencyMap.entries()) {
    node.allDeps = allDependencies(
      id,
      dependencyMap,
      node,
      node.allDeps,
      new Set()
    )
  }
  return dependencyMap
}

function allDependencies(
  rootId: string,
  map: Map<string, DependencyNode>,
  node: DependencyNode,
  acc: Set<string>,
  visited: Set<string>
) {
  for (const x of node.directDeps) {
    if (visited.has(x)) continue
    visited.add(x)
    if (x !== rootId) acc.add(x)
    allDependencies(rootId, map, map.get(x)!, acc, visited)
  }
  return acc
}

export type DependencyMapArray = Array<
  [string, { directDeps: string[]; allDeps: string[] }]
>
function dependencyMapToArray(dependencyMap: Map<string, DependencyNode>) {
  const arr: DependencyMapArray = []

  for (const [k, { directDeps, allDeps }] of dependencyMap.entries()) {
    arr.push([
      k,
      { directDeps: Array.from(directDeps), allDeps: Array.from(allDeps) },
    ])
  }

  return arr
}

export function dependencyMapArrayFromInputs(inputs: Metadata['inputs']) {
  const map = buildDependencyMap(inputs)
  const arr = dependencyMapToArray(map)
  return arr
}

function dependencyArrayToResolvedMap(
  arr: DependencyMapArray,
  projectBaseDir: string
) {
  // NOTE: using path.resolve here guarantess that map keys/values are native slashed
  // even though the included dependency map array uses always forward slashes
  const map: Map<string, DependencyNode> = new Map()
  for (const [k, { directDeps, allDeps }] of arr) {
    const resolvedKey = path.resolve(projectBaseDir, k)
    const resolvedDirectDeps = directDeps.map((x) =>
      path.resolve(projectBaseDir, x)
    )
    const resolvedAllDeps = allDeps.map((x) => path.resolve(projectBaseDir, x))
    map.set(resolvedKey, {
      directDeps: new Set(resolvedDirectDeps),
      allDeps: new Set(resolvedAllDeps),
    })
  }
  return map
}

export class DependencyMap {
  constructor(private readonly dependencyMap: Map<string, DependencyNode>) {}

  allDepsOf(nodeId: string) {
    const node = this.dependencyMap.get(nodeId)
    assert(node != null, `Node with ${nodeId} needs to be in map`)
    return Array.from(node.allDeps)
  }

  directDepsOf(nodeId: string) {
    const node = this.dependencyMap.get(nodeId)
    assert(node != null, `Node with ${nodeId} needs to be in map`)
    return Array.from(node.directDeps)
  }
  loadedButNotCached(
    id: string,
    loaded: Set<string>,
    cache: Record<string, NodeModule>
  ) {
    if (!loaded.has(id)) return false
    return cache[id] == null
  }

  criticalDependencyLoadedButNotCached(
    id: string,
    loaded: Set<string>,
    cache: Record<string, NodeModule>
  ) {
    assert(cache[id] == null, 'Should not query for modules that are in cache')

    const node = this.dependencyMap.get(id)
    // Shouldn't be invoked for with a module that isn't in the snapshot, since then it wouldn't
    // be in snapshot exports either
    assert(
      node != null,
      'should not check dependencies that are not inside the snapshot'
    )
    for (const childId of node.directDeps) {
      if (this.loadedButNotCached(childId, loaded, cache)) return true
    }

    // Unfortunately the most likely case is the most expensive.
    const indirectsToReach: Set<string> = new Set()
    for (const childId of node.allDeps) {
      if (this.loadedButNotCached(childId, loaded, cache))
        indirectsToReach.add(childId)
    }
    if (indirectsToReach.size > 0) {
      const visited: Set<string> = new Set()
      return this._reachableWithoutHittingCache(
        node,
        indirectsToReach,
        loaded,
        cache,
        visited
      )
    }
    return false
  }

  private _reachableWithoutHittingCache(
    node: DependencyNode,
    toReach: Set<string>,
    loaded: Set<string>,
    cache: Record<string, NodeModule>,
    visited: Set<string>
  ) {
    // Walk the tree until we either hit a module that is cached or is one of the modules we try to reach
    for (const child of node.directDeps) {
      if (visited.has(child)) continue
      visited.add(child)
      if (toReach.has(child)) return true
      if (cache[child] == null) {
        const childNode = this.dependencyMap.get(child)
        if (
          childNode != null &&
          this._reachableWithoutHittingCache(
            childNode,
            toReach,
            loaded,
            cache,
            visited
          )
        ) {
          return true
        }
      }
    }
    return false
  }

  static fromDepArrayAndBaseDir(
    arr: DependencyMapArray,
    projectBaseDir: string
  ) {
    const map = dependencyArrayToResolvedMap(arr, projectBaseDir)
    return new DependencyMap(map)
  }
}

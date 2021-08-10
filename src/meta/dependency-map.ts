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

  for (const node of dependencyMap.values()) {
    node.allDeps = allDependencies(dependencyMap, node, node.allDeps)
  }
  return dependencyMap
}

function allDependencies(
  map: Map<string, DependencyNode>,
  node: DependencyNode,
  acc: Set<string>
) {
  for (const x of node.directDeps) {
    acc.add(x)
    allDependencies(map, map.get(x)!, acc)
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
      return this._reachableWithoutHittingCache(
        node,
        indirectsToReach,
        loaded,
        cache
      )
    }
    return false
  }

  private _reachableWithoutHittingCache(
    node: DependencyNode,
    toReach: Set<string>,
    loaded: Set<string>,
    cache: Record<string, NodeModule>
  ) {
    // Walk the tree until we either hit a module that is cached or is one of the modules we try to reach
    for (const child of node.directDeps) {
      if (toReach.has(child)) return true
      if (cache[child] == null) {
        const childNode = this.dependencyMap.get(child)
        if (
          childNode != null &&
          this._reachableWithoutHittingCache(childNode, toReach, loaded, cache)
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

import test from 'tape'
import { buildDependencyMap, DependencyMap } from '../..//meta/dependency-map'
import { Metadata } from '../../types'

const NO_DEPS = 'lib/fixtures/no-deps.js'
const SYNC_DEPS = 'lib/fixtures/sync-deps.js'
const DEEP_SYNC_DEPS = 'lib/fixtures/deep-sync-deps.js'
const KEEP_JS = 'lib/keep.js'

const allIds = [NO_DEPS, SYNC_DEPS, DEEP_SYNC_DEPS, KEEP_JS]

/*
 * + KEEP_JS
 * |
 * +---- DEEP_SYNC_DEPS
 * |     |
 * |     |
 * |     + --- SYNC_DEPS
 * |           |
 * |           +--- NO_DEPS
 * |
 * +---  SYNC_DEPS
 *       |
 *       +--- NO_DEPS
 */

const inputs: Metadata['inputs'] = {
  'lib/fixtures/no-deps.js': {
    imports: [],
  },
  'lib/fixtures/sync-deps.js': {
    imports: [
      {
        path: 'lib/fixtures/no-deps.js',
        kind: 'require-call',
      },
    ],
  },
  'lib/fixtures/deep-sync-deps.js': {
    imports: [
      {
        path: 'lib/fixtures/sync-deps.js',
        kind: 'require-call',
      },
    ],
  },
  'lib/keep.js': {
    imports: [
      {
        path: 'lib/fixtures/deep-sync-deps.js',
        kind: 'require-call',
      },
      {
        path: 'lib/fixtures/sync-deps.js',
        kind: 'require-call',
      },
    ],
  },
} as unknown as Metadata['inputs']

const map = buildDependencyMap(inputs)
const dp = new DependencyMap(map)

test('dependency-map: loaded but not cached', (t) => {
  const loaded: Set<string> = new Set()
  const cache: Record<string, NodeModule> = {}
  t.comment('++ Initally nothing is loaded nor cached ++')
  for (const id of allIds) {
    t.equal(
      dp.loadedButNotCached(id, loaded, cache),
      false,
      `${id} not 'loaded but not cached'`
    )
  }

  t.comment('++ Loading all Modules ++')
  for (const id of allIds) {
    cache[id] = {} as NodeModule
    loaded.add(id)
  }
  for (const id of allIds) {
    t.equal(
      dp.loadedButNotCached(id, loaded, cache),
      false,
      `${id} not 'loaded but not cached'`
    )
  }

  t.comment('++ Deleting NO_DEPS from Cache ++')
  delete cache[NO_DEPS]

  for (const id of allIds) {
    const res = id === NO_DEPS
    t.equal(
      dp.loadedButNotCached(id, loaded, cache),
      res,
      `${id} ${res ? '' : 'not '} 'loaded but not cached'`
    )
  }

  t.comment('++ Deleting SYNC_DEPS from Cache ++')
  delete cache[SYNC_DEPS]

  for (const id of allIds) {
    const res = id === NO_DEPS || id === SYNC_DEPS
    t.equal(
      dp.loadedButNotCached(id, loaded, cache),
      res,
      `${id} ${res ? '' : 'not '} 'loaded but not cached'`
    )
  }

  t.end()
})

test('dependency-map: critical dependency loaded but not cached', (t) => {
  const loaded: Set<string> = new Set()
  const cache: Record<string, NodeModule> = {}

  const load = (id: string) => {
    cache[id] = {} as NodeModule
    loaded.add(id)
  }

  t.comment('++ Loading NO_DEPS ++')
  load(NO_DEPS)

  t.equal(
    dp.criticalDependencyLoadedButNotCached(SYNC_DEPS, loaded, cache),
    false,
    'SYNC_DEPS needs no reload'
  )

  t.comment('++ Removing NO_DEPS from cache ++')
  delete cache[NO_DEPS]

  t.equal(
    dp.criticalDependencyLoadedButNotCached(SYNC_DEPS, loaded, cache),
    true,
    'SYNC_DEPS needs reload since not in cache and NO_DEPS is direct dep'
  )

  t.equal(
    dp.criticalDependencyLoadedButNotCached(DEEP_SYNC_DEPS, loaded, cache),
    true,
    'DEEP_SYNC_DEPS needs reload since a cache free path to NO_DEPS exists'
  )

  t.equal(
    dp.criticalDependencyLoadedButNotCached(KEEP_JS, loaded, cache),
    true,
    'KEEP_JS needs reload since a cache free path to NO_DEPS exists'
  )

  t.comment('++ Load SYNC_DEPS which adds it to cache ++')
  load(SYNC_DEPS)

  t.equal(
    dp.criticalDependencyLoadedButNotCached(DEEP_SYNC_DEPS, loaded, cache),
    false,
    'DEEP_SYNC_DEPS needs no reload since no cache free path to NO_DEPS exists'
  )

  t.equal(
    dp.criticalDependencyLoadedButNotCached(KEEP_JS, loaded, cache),
    false,
    'KEEP_JS needs no reload since no cache free path to NO_DEPS exists'
  )
  t.end()
})

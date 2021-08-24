import test from 'tape'
import { buildDependencyMap, DependencyMap } from '../..//meta/dependency-map'
import { Metadata } from '../../types'

const ROOT = 'lib/root.js'
const FOO = 'lib/foo.js'
const BAR = 'lib/bar.js'
const BAZ = 'lib/baz.js'
const FOZ = 'lib/foz.js'

/*
 * + ROOT
 * |
 * +---- FOO
 *       |
 *       + --- BAR
 *             |
 *             +--- BAZ
 *                  |
 *                  + --- FOZ
 *                  |
 *                  |
 *                  + --- FOO (circular ref)
 *
 */

const ALL_ROOT = [FOO, BAR, BAZ, FOZ]
const ALL_FOO = [BAR, BAZ, FOZ]
const ALL_BAR = [BAZ, FOZ, FOO]
const ALL_BAZ = [FOZ, FOO, BAR]
const ALL_FOZ: string[] = []

const DIRECT_ROOT = [FOO]
const DIRECT_FOO = [BAR]
const DIRECT_BAR = [BAZ]
const DIRECT_BAZ = [FOZ, FOO]
const DIRECT_FOZ: string[] = []

const inputs: Metadata['inputs'] = {
  [ROOT]: {
    imports: [
      {
        path: FOO,
        kind: 'require-call',
      },
    ],
  },
  [FOO]: {
    imports: [
      {
        path: BAR,
        kind: 'require-call',
      },
    ],
  },
  [BAR]: {
    imports: [
      {
        path: BAZ,
        kind: 'require-call',
      },
    ],
  },
  [BAZ]: {
    imports: [
      {
        path: FOZ,
        kind: 'require-call',
      },
      {
        path: FOO,
        kind: 'require-call',
      },
    ],
  },
  [FOZ]: {
    imports: [],
  },
} as unknown as Metadata['inputs']

const map = buildDependencyMap(inputs)
const dp = new DependencyMap(map)

test('dependency-map: with circular dep - all deps ', (t) => {
  t.deepEqual(dp.allDepsOf(ROOT), ALL_ROOT, 'all root deps')
  t.deepEqual(dp.allDepsOf(FOO), ALL_FOO, 'all foo deps')
  t.deepEqual(dp.allDepsOf(BAR), ALL_BAR, 'all bar deps')
  t.deepEqual(dp.allDepsOf(BAZ), ALL_BAZ, 'all baz deps')
  t.deepEqual(dp.allDepsOf(FOZ), ALL_FOZ, 'all foz deps')
  t.end()
})

test('dependency-map: with circular dep - direct deps ', (t) => {
  t.deepEqual(dp.directDepsOf(ROOT), DIRECT_ROOT, 'direct root deps')
  t.deepEqual(dp.directDepsOf(FOO), DIRECT_FOO, 'direct foo deps')
  t.deepEqual(dp.directDepsOf(BAR), DIRECT_BAR, 'direct bar deps')
  t.deepEqual(dp.directDepsOf(BAZ), DIRECT_BAZ, 'direct baz deps')
  t.deepEqual(dp.directDepsOf(FOZ), DIRECT_FOZ, 'direct foz deps')
  t.end()
})

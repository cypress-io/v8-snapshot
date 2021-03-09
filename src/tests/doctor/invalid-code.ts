import spok from 'spok'
import path from 'path'
import test from 'tape'
import { readResult, bundlerPath } from './utils/bundle'
import { Flag, SnapshotGenerator } from '../../../'

const projectBaseDir = path.join(__dirname, 'fixtures', 'invalid-code')
const cacheDir = path.join(projectBaseDir, 'cache')
const snapshotEntryFile = path.join(projectBaseDir, 'entry.js')

test('snapshot: entry points to a valid and and invalid module', async (t) => {
  const generator = new SnapshotGenerator(
    bundlerPath,
    projectBaseDir,
    snapshotEntryFile,
    {
      cacheDir,
      nodeModulesOnly: false,
      flags: Flag.Script,
    }
  )
  await generator.createExportBundle()
  const { meta, exported } = readResult(cacheDir)

  spok(t, meta, {
    $topic: 'snapshot meta',
    norewrite: ['./invalid-module.js'],
    deferred: [],
    healthy: ['./entry.js', './valid-module.js'],
  })
  spok(
    t,
    { keys: Object.keys(exported) },
    {
      $topic: 'exported',
      keys: ['./valid-module.js', './invalid-module.js', './entry.js'],
    }
  )
  t.notOk(
    exported['./invalid-module.js'].toString().includes('get_console'),
    'invalid-module.js: does not rewrite console'
  )
  t.ok(
    exported['./valid-module.js'].toString().includes('get_console'),
    'valid-module.js: does rewrite console'
  )
  t.end()
})

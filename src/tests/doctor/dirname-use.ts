import spok from 'spok'
import path from 'path'
import test from 'tape'
import { readResult, bundlerPath } from './utils/bundle'
import { Flag, SnapshotGenerator } from '../../../'

const projectBaseDir = path.join(__dirname, 'fixtures', 'dirname-use')
const cacheDir = path.join(projectBaseDir, 'cache')
const snapshotEntryFile = path.join(projectBaseDir, 'entry.js')

test('snapshot: entry points two modules, one using __dirname', async (t) => {
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
    norewrite: [],
    deferred: ['./using-dirname.js'],
    healthy: ['./entry.js', './valid-module.js'],
  })
  spok(
    t,
    { keys: Object.keys(exported) },
    {
      $topic: 'exported',
      keys: ['./valid-module.js', './using-dirname.js', './entry.js'],
    }
  )
  t.end()
})

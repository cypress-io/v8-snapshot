import { strict as assert } from 'assert'
import path from 'path'
import { SnapshotGenerator, Flag } from '../../'
import test from 'tape'

const projectBaseDir = path.join(__dirname, 'fixtures', 'invalid-code')
const cacheDir = path.join(projectBaseDir, 'cache')
const snapshotEntryFile = path.join(projectBaseDir, 'entry.js')

const bundlerPath = process.env.BUNDLER

test('snapshot: entry points ot a valid and and invalid module', async (t) => {
  // TODO: include bundler with this package
  assert(bundlerPath, 'need to set BUNDLER env var')

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
  await generator.createScript()
  t.end()
})

import path from 'path'
import test from 'tape'
import { SnapshotGenerator } from '../../snapshot-generator'
import { exec as execOrig } from 'child_process'
import { promisify } from 'util'

import rimraf from 'rimraf'
const rmrf = promisify(rimraf)

const exec = promisify(execOrig)

const projectBaseDir = path.join(__dirname, 'fixtures', 'stealthy-require')
const cacheDir = path.join(projectBaseDir, 'cache')

test('stealthy-require: all cached ', async (t) => {
  await rmrf(cacheDir)
  const snapshotEntryFile = path.join(projectBaseDir, 'entry-all-cached.js')
  const generator = new SnapshotGenerator(projectBaseDir, snapshotEntryFile, {
    cacheDir,
    nodeModulesOnly: false,
  })
  await generator.createScript()
  await generator.makeAndInstallSnapshot()

  const env: Record<string, any> = {
    ELECTRON_RUN_AS_NODE: 1,
    DEBUG: '(packherd|snapgen):*',
    PROJECT_BASE_DIR: projectBaseDir,
    DEBUG_COLORS: 1,
  }
  const cmd =
    `node ${require.resolve('electron/cli')}` +
    ` -r ${projectBaseDir}/hook-require.js` +
    ` ${projectBaseDir}/spec/non-native.js`

  console.log('RUNNING')
  try {
    const { stdout, stderr } = await exec(cmd, { env })
    console.log('stdout')
    console.log(stdout)
    console.log('stderr')
    console.log(stderr)
  } catch (err) {
    t.fail(err.toString())
  }
})

import path from 'path'
import test from 'tape'
import { SnapshotGenerator } from '../../snapshot-generator'
import { exec as execOrig } from 'child_process'
import { promisify } from 'util'
import { electronExecutable } from '../utils/consts'

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
    `${electronExecutable} -r ${projectBaseDir}/hook-require.js` +
    ` ${projectBaseDir}/spec/non-native.js`

  try {
    const { stdout, stderr } = await exec(cmd, { env })
    const lines = stdout.split('\n')
    if (lines[lines.length - 2] !== '# PASS') {
      console.error('stdout:')
      console.error(stdout)
      console.error('stderr:')
      console.error(stderr)
      t.fail('stdout had #FAIL')
    } else {
      console.error('stderr:')
      console.error(stderr)
      console.error('stdout:')
      console.error(stdout)
      t.pass('stdout did not have #FAIL')
    }
  } catch (err: any) {
    t.fail(err.toString())
  }
})

import path from 'path'
import test from 'tape'
import { SnapshotGenerator } from '../../snapshot-generator'
import { exec as execOrig } from 'child_process'
import { promisify } from 'util'

import rimraf from 'rimraf'
const rmrf = promisify(rimraf)

const exec = promisify(execOrig)

const projectBaseDir = path.join(__dirname, 'fixtures', 'require-cache')
const cacheDir = path.join(projectBaseDir, 'cache')

test('require: cached module modifies require cache', async (t) => {
  await rmrf(cacheDir)

  const snapshotEntryFile = path.join(projectBaseDir, 'cached-manipulator.js')
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
    ` ${projectBaseDir}/cached-app.js`

  try {
    const { stdout } = await exec(cmd, { env })
    const { sync1, sync2, rand1, rand2 } = JSON.parse(stdout.trim())
    t.notEqual(sync1, sync2, 'sync deps export should be different')
    t.notEqual(rand1, rand2, 'rand deps export should be different')
  } catch (err) {
    t.fail(err.toString())
  }
})

test('require: uncached module modifies require cache', async (t) => {
  await rmrf(cacheDir)

  const snapshotEntryFile = path.join(projectBaseDir, 'uncached-entry.js')
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
    ` ${projectBaseDir}/uncached-app.js`

  try {
    const { stdout } = await exec(cmd, { env })
    const { sync1, sync2, rand1, rand2 } = JSON.parse(stdout.trim())
    t.notEqual(sync1, sync2, 'sync deps export should be different')
    t.notEqual(rand1, rand2, 'rand deps export should be different')
  } catch (err) {
    t.fail(err.toString())
  }
})

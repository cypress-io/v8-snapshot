import path from 'path'
import spok from 'spok'
import test from 'tape'
import { SnapshotGenerator } from '../../snapshot-generator'
import { exec as execOrig } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execOrig)

const projectBaseDir = path.join(__dirname, 'fixtures', 'esm')
const cacheDir = path.join(projectBaseDir, 'cache')
const snapshotEntryFile = path.join(projectBaseDir, 'entry.mjs')

test('esm support: entry esm module importing a lodash function', async (t) => {
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
    ` ${projectBaseDir}/app.js`

  try {
    const { stdout } = await exec(cmd, { env })
    const res = JSON.parse(stdout.trim())
    spok(t, res, { isObjectLike: true })
  } catch (err: any) {
    t.fail(err.toString())
  }
})

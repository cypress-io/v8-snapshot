import path from 'path'
import test from 'tape'
import { SnapshotGenerator } from '../../snapshot-generator'
import { exec as execOrig } from 'child_process'
import { promisify } from 'util'
import { electronExecutable } from '../utils/consts'

const exec = promisify(execOrig)

const projectBaseDir = path.join(__dirname, 'fixtures', 'require-full-path-var')
const cacheDir = path.join(projectBaseDir, 'cache')
const snapshotEntryFile = path.join(projectBaseDir, 'entry.js')

test('require: loading from full path provided via variable', async (t) => {
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
    ` ${projectBaseDir}/app.js`

  let stdout: string | undefined
  let stderr: string | undefined
  try {
    ;({ stdout, stderr } = await exec(cmd, { env }))
    const res = JSON.parse(stdout.trim())
    t.equal(res.version, '1.1.1')
  } catch (err: any) {
    console.log(stdout)
    console.log(stderr)
    t.fail(err.toString())
  }
})

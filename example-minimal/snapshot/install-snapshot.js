const SKIP_CREATE = false
const VERIFY = false

process.env.DEBUG = 'snapgen:*'
const path = require('path')
const { SnapshotGenerator } = require('../../')

const projectBaseDir = path.join(__dirname, '../')
const snapshotEntryFile = require.resolve('./snapshot.js')
const appEntryFile = require.resolve('../app/index')

if (process.env.BUNDLER == null) {
  console.error(
    'Need to provide path to bundler via "BUNDLER=<bundler> node install-snaphot"'
  )
  process.exit(1)
}

const cacheDir =
  process.env.LINK == 1
    ? path.resolve(__dirname, '../cache-link')
    : path.resolve(__dirname, '../cache')
const bundlerPath = path.resolve(process.env.BUNDLER)
const snapshotGenerator = new SnapshotGenerator(
  bundlerPath,
  projectBaseDir,
  snapshotEntryFile,
  // appEntryFile,
  { minify: false, verify: VERIFY, cacheDir, nodeModulesOnly: false }
)

;(async () => {
  try {
    if (SKIP_CREATE) {
      snapshotGenerator.snapshotScript = require('fs').readFileSync(
        snapshotGenerator.snapshotScriptPath,
        'utf8'
      )
    } else {
      await snapshotGenerator.createScript()
    }
    snapshotGenerator.makeSnapshot()
    snapshotGenerator.installSnapshot()
  } catch (err) {
    console.error(err)
  }
})()

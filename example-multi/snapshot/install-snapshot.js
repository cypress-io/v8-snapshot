const SKIP_CREATE = false

process.env.DEBUG = 'snapgen:*'
const path = require('path')
const { SnapshotGenerator, prettyPrintError } = require('../../')

const projectBaseDir = path.join(__dirname, '../')
const snapshotEntryFile = require.resolve('./snapshot.js')

if (process.env.BUNDLER == null) {
  console.error(
    'Need to provide path to bundler via "BUNDLER=<bundler> node install-snaphot"'
  )
  process.exit(1)
}

const cacheDir = path.resolve(__dirname, '../cache')
const bundlerPath = path.resolve(process.env.BUNDLER)
const snapshotGenerator = new SnapshotGenerator(
  bundlerPath,
  projectBaseDir,
  snapshotEntryFile,
  { cacheDir }
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
    // TODO: should be part of API
    if (snapshotGenerator.makeSnapshot()) {
      snapshotGenerator.installSnapshot()
    } else {
      throw new Error('make snapshot failed')
    }
  } catch (err) {
    prettyPrintError(err, projectBaseDir)
    process.exit(1)
  }
})()

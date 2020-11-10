process.env.DEBUG = 'snapgen:*'
const path = require('path')
const { SnapshotGenerator } = require('../../')

const projectBaseDir = path.resolve(__dirname, '..')
const snapshotEntryFile = process.env.RENDERER
  ? require.resolve('../app/renderer')
  : require.resolve('./snapshot.js')

if (process.env.BUNDLER == null) {
  console.error(
    'Need to provide path to bundler via "BUNDLER=<bundler> node install-snaphot"'
  )
  process.exit(1)
}

const bundlerPath = path.resolve(process.env.BUNDLER)
const snapshotGenerator = new SnapshotGenerator(
  bundlerPath,
  projectBaseDir,
  snapshotEntryFile
)

;(async () => {
  try {
    await snapshotGenerator.createScript()
    snapshotGenerator.makeSnapshot()
    snapshotGenerator.installSnapshot()
  } catch (err) {
    console.error(err)
  }
})()

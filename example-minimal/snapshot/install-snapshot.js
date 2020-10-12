process.env.DEBUG = 'snapgen:*'
const path = require('path')
const { SnapshotGenerator } = require('../../')

const projectBaseDir = path.join(__dirname, '../')
const snapshotEntryFile = process.env.RENDERER
  ? require.resolve('../app/renderer')
  : require.resolve('./snapshot.js')

const snapshotGenerator = new SnapshotGenerator(
  projectBaseDir,
  snapshotEntryFile,
  { minify: false }
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

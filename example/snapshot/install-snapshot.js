process.env.DEBUG = 'snapgen:*'
const path = require('path')
const { SnapshotGenerator } = require('../../')

const projectBaseDir = path.resolve(__dirname, '..')
const snapshotEntryFile = process.env.RENDERER
  ? require.resolve('../app/renderer')
  : require.resolve('./snapshot.js')

const snapshotGenerator = new SnapshotGenerator(
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

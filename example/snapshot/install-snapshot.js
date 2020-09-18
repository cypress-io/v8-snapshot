process.env.DEBUG = 'snapgen:*'
const path = require('path')
const { SnapshotGenerator } = require('../../')

const projectBaseDir = path.join(__dirname, '../')
const snapshotEntryFile = require.resolve('../app/renderer')

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

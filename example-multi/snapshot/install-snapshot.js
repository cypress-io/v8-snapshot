const path = require('path')
const { SnapshotGenerator, prettyPrintError } = require('../../')

const projectBaseDir = path.join(__dirname, '../')
const snapshotEntryFile = require.resolve('./snapshot.js')

function resolvePrevious() {
  try {
    const {
      deferreds: previousDeferreds,
      healthy: previousHealthy,
    } = require('../cache/snapshot-meta.prev.json')
    return { previousDeferreds, previousHealthy }
  } catch (_) {
    return {}
  }
}
const { previousDeferreds, previousHealthy } = resolvePrevious()

const cacheDir = path.resolve(__dirname, '../cache')
const snapshotGenerator = new SnapshotGenerator(
  projectBaseDir,
  snapshotEntryFile,
  { cacheDir, previousDeferreds, previousHealthy }
)

;(async () => {
  try {
    await snapshotGenerator.createScript()
    snapshotGenerator.makeAndInstallSnapshot()
  } catch (err) {
    prettyPrintError(err, projectBaseDir)
    process.exit(1)
  }
})()

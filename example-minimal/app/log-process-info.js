function snapshotInfo() {
  if (typeof snapshotResult === 'undefined')
    return {
      cached: 0,
      defined: 0,
      index: null,
      renderer: null,
    }

  return {
    cached: Object.keys(snapshotResult.customRequire.cache).length,
    defined: Object.keys(snapshotResult.customRequire.definitions).length,
    index: snapshotResult.index,
    renderer: snapshotResult.renderer,
  }
}
module.exports = function logProcessInfo(loc) {
  console.log({
    loc,
    snapshot: snapshotInfo(),
    electron: process.versions.electron,
    node: process.versions.node,
    isRenderer: (() => {
      if (typeof process === 'undefined') return true
      if (!process) return true
      return process.type === 'renderer'
    })(),
    process: { index: process.index, renderer: process.renderer },
    global: { index: global.index, renderer: global.renderer },
  })
}

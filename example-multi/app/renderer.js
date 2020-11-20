console.time('startup')
const path = require('path')
const projectBaseDir = path.resolve(__dirname, '..')
const _ = require('../../').snapshotRequire(projectBaseDir)

console.time('load-snapshot')
const ss = require('../snapshot/snapshot')

// Ensuring that util.inspect works and thus the `util` stub isn't affecting
// loading this core module at runtime.
// Same for events.
const { inspect } = require('util')
const { EventEmitter } = require('events')

console.timeEnd('load-snapshot')
console.timeEnd('startup')
if (!global.isGeneratingSnapshot) {
  console.log(inspect(ss))
  console.log(inspect(new EventEmitter()))
}

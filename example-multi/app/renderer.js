console.time('entire-startup')
const path = require('path')
const projectBaseDir = path.resolve(__dirname, '..')
const _ = require('../../').snapshotRequire(projectBaseDir)

console.time('load-deps')
const ss = require('../snapshot/snapshot')
console.timeEnd('load-deps')
console.timeEnd('entire-startup')

// Below just some checks that everything worked as expected.
// Ensuring that util.inspect works and thus the `util` stub isn't affecting
// loading this core module at runtime.
// Same for events.
const { inspect } = require('util')
const { EventEmitter } = require('events')

if (!global.isGeneratingSnapshot) {
  console.log(inspect(ss))
  console.log(inspect(new EventEmitter()))
}

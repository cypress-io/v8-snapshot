const path = require('path')

const isObject = require('isobject')
const tmpfile = require('tmpfile')

global.renderer = process.renderer = 'SET_RENDERER'
if (typeof snapshotResult !== 'undefined') {
  snapshotResult.renderer = global.renderer
}
require('./log-process-info')('./renderer')

console.log(isObject(tmpfile))

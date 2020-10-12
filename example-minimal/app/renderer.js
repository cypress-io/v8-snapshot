const path = require('path')
const projectBaseDir = path.resolve(__dirname, '..')
const _ = require('../../').snapshotRequire(projectBaseDir)

const isObject = require('isobject')
const tmpfile = require('tmpfile')

if (!global.isGeneratingSnapshot) {
  console.log(isObject(tmpfile))
}

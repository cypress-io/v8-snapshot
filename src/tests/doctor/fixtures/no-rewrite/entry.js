// @ts-check
'use strict'

const fs = require('fs')
const patch = require('./graceful-fs-polyfill')

module.exports = function patchFs() {
  patch(fs)
}

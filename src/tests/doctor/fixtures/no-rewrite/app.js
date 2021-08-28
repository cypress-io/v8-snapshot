// @ts-check
'use strict'

const fs = require('fs')

const patch = require('./entry')
patch()
console.log(JSON.stringify({ patchedCwd: fs.patchedCwd }))

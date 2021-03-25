// @ts-check
'use strict'

const path = require('path')

const _ = require('../../').snapshotRequire(path.resolve(__dirname, '..'), {
  diagnostics: true,
  useCache: true,
})

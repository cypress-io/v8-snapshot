const path = require('path')
const entryFile = require.resolve('./index')
const _ = require('../../').snapshotRequire(path.dirname(entryFile), {
  diagnostics: true,
  useCache: true,
})

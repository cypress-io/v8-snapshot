const entryFile = require.resolve('./index')
const _ = require('../../').snapshotRequire(entryFile, { diagnostics: true })
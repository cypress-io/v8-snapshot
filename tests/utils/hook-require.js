'use strict'
const path = require('path')
const { DirtSimpleFileCache } = require('dirt-simple-file-cache')
const { packherdRequire } = require('packherd')

packherdRequire(path.dirname(require.resolve('../../package.json')), {
  transpileOpts: {
    supportTS: true,
    // initTranspileCache: DirtSimpleFileCache.initSync,
    tsconfig: {
      compilerOptions: {
        useDefineForClassFields: false,
        importsNotUsedAsValues: 'remove',
      },
    },
  },
})

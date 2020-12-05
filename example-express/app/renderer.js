console.time('entire-startup')

const path = require('path')
const projectBaseDir = path.resolve(__dirname, '..')
const _ = require('../../').snapshotRequire(projectBaseDir)

console.time('init-express')
console.time('load-express')
const express = require('express')
console.timeEnd('load-express')

console.time('start-express-after-loaded')
const app = express()
const port = 3000
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
  console.timeEnd('start-express-after-loaded')
  console.timeEnd('init-express')
  console.timeEnd('entire-startup')
})

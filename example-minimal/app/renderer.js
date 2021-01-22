const path = require('path')

const isObject = require('isobject')
const tmpfile = require('tmpfile')

console.log(isObject(tmpfile))

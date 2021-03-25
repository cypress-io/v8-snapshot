const isObject = require('isobject')
const tmpfile = require('tmpfile')

console.log({
  isTmpFileObject: isObject(tmpfile),
  isTmpModuleObject: isObject(module),
})

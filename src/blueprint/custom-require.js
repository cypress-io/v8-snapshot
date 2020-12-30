//
// <custom-require>
//
let require = (moduleName) => {
  throw new Error(
    `Cannot require module "${moduleName}".\n` +
      "To use Node's require you need to call `snapshotResult.setGlobals` first!"
  )
}

function customRequire(modulePath) {
  let module = customRequire.cache[modulePath]

  if (!module) {
    module = {
      exports: {},
    }
    const dirname = modulePath.split('/').slice(0, -1).join('/')

    function define(callback) {
      callback(customRequire, module.exports, module)
    }

    if (customRequire.definitions.hasOwnProperty(modulePath)) {
      customRequire.cache[modulePath] = module
      customRequire.definitions[modulePath].apply(module.exports, [
        module.exports,
        module,
        modulePath,
        dirname,
        customRequire,
        define,
      ])
    } else if (coreStubs.hasOwnProperty(modulePath)) {
      module.exports = coreStubs[modulePath]
      // we don't cache core modules but only serve stubs to not break snapsshotting
    } else {
      try {
        module.exports = require(modulePath)
        customRequire.cache[modulePath] = module
      } catch (err) {
        console.error('Failed to require', modulePath)
      }
    }
  }

  return module.exports
}

customRequire.extensions = {}
customRequire.cache = {}

customRequire.resolve = function (mod) {
  return require.resolve(mod)
}
//
// </custom-require>
//

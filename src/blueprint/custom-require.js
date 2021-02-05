//
// <custom-require>
//
let require = (moduleName) => {
  throw new Error(
    `Cannot require module "${moduleName}".\n` +
      "To use Node's require you need to call `snapshotResult.setGlobals` first!"
  )
}

// TODO(thlorenz): configurable
const SNAPSHOT_PROJECT_ROOT = '/Volumes/d/dev/cy/perf-tr1/cypress-latest/'

// TODO(thlorenz): esbuild needs to pass the parent. For now this makes modules that
// check for `module.parent` to determine if they are run from CLI behave correctly
function customRequire(modulePath, parent = {}) {
  let module = customRequire.cache[modulePath]

  if (!module) {
    module = {
      exports: {},
    }
    if (modulePath.includes('fsevents.node')) {
      debugger
    }
    // TODO(thlorenz): hack for now .. won't work in some circumstances, esp. not on windows
    // also how would this work in prod if we hard code the full path?
    const relPath = modulePath.replace(/^\.\//, '')
    const filename = relPath.startsWith('/')
      ? relPath
      : `${SNAPSHOT_PROJECT_ROOT}/${relPath}`
    const dirname = filename.split('/').slice(0, -1).join('/')

    function define(callback) {
      callback(customRequire, module.exports, module)
    }

    if (customRequire.definitions.hasOwnProperty(modulePath)) {
      module.parent = parent
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
        // This happens when `require` calls were dynamic and not resolved by esbuild
        // i.e. `require(opts.typescript)`
        // Let's hope it's a node_module located at the root otherwise we just have to fail.
        try {
          module.exports = require(`${SNAPSHOT_PROJECT_ROOT}/node_modules/${modulePath}`)
          customRequire.cache[modulePath] = module
        } catch (err) {
          console.error('Failed to require', modulePath)
          debugger
        }
      }
    }
  }

  return module.exports
}

customRequire.extensions = {}
customRequire.cache = {}

customRequire.resolve = function (mod) {
  try {
    return require.resolve(mod)
  } catch (err) {
    try {
      // TODO(thlorenz): Technically this is incorrect as it should resolve relative to the module calling
      // `require.resolve` which means we'd need to pass the `__dirname` of that module via esbuild
      return require.resolve(`${SNAPSHOT_PROJECT_ROOT}/node_modules/${mod}`)
    } catch (err) {
      console.error('Failed to resolve', mod)
      debugger
    }
  }
}
//
// </custom-require>
//

//
// <custom-require>
//
let require = (moduleName) => {
  throw new Error(
    `[SNAPSHOT_CACHE_FAILURE] Cannot require module "${moduleName}"`
  )
}

function customRequire(
  modulePath,
  modulePathFromAppRoot,
  parentRelFilename,
  parentRelDirname
) {
  const snapshotting = generateSnapshot != null
  let key = modulePathFromAppRoot ?? modulePath

  // Windows
  if (PATH_SEP !== '/') {
    modulePath = modulePath.startsWith('./')
      ? `./${modulePath.slice(2).replace(/\//g, '\\')}`
      : modulePath.replace(/\//g, '\\')

    if (key != null) {
      key = key.startsWith('./')
        ? `./${key.slice(2).replace(/\//g, '\\')}`
        : key.replace(/\//g, '\\')
    }
  }

  let module = customRequire.exports[key]
  if (module != null) {
    const loader /* NodeModule */ = this
    const { parent, filename, dirname } = resolvePathsAndParent(
      snapshotting,
      modulePathFromAppRoot,
      parentRelFilename,
      parentRelDirname,
      loader
    )
    module.parent = parent
    module.id = filename
    module.filename = filename
    module.dirname = dirname
  }

  const cannotUseCached =
    module == null ||
    (!snapshotting &&
      typeof require.shouldBypassCache === 'function' &&
      require.shouldBypassCache(module))

  if (cannotUseCached) {
    var { parent, filename, dirname } = resolvePathsAndParent(
      snapshotting,
      modulePathFromAppRoot ?? modulePath,
      parentRelFilename,
      parentRelDirname
    )

    module = {
      exports: {},
      children: [],
      loaded: true,
      parent,
      paths: [],
      require: customRequire,
      filename,
      id: filename,
      path: dirname,
    }

    function define(callback) {
      callback(customRequire, module.exports, module)
    }

    if (customRequire.definitions.hasOwnProperty(key)) {
      customRequire.exports[key] = module
      customRequire.definitions[key].apply(module.exports, [
        module.exports,
        module,
        filename,
        dirname,
        customRequire,
        define,
      ])
    } else {
      try {
        module.exports = require(modulePath)
        customRequire.exports[modulePath] = module
      } catch (err) {
        // If we're running in doctor (strict) mode avoid trying to resolve core modules by path
        if (require.isStrict) {
          throw err
        } else {
          debugger
          throw new Error(
            `Failed to require ${modulePath} with key ${key}.\n${err.toString()}`
          )
        }
      }
    }
  }

  if (typeof require.registerModuleLoad === 'function') {
    require.registerModuleLoad(module)
  }

  return module.exports
}

customRequire.extensions = {}
customRequire.exports = {}

function resolvePathsAndParent(
  snapshotting,
  modulePathFromAppRoot,
  parentRelFilename,
  parentRelDirname,
  loader /* NodeModule */
) {
  let filename, dirname, parentFilename, parentDirname

  if (snapshotting || !modulePathFromAppRoot.startsWith('.')) {
    filename = modulePathFromAppRoot
    dirname = filename.split(PATH_SEP).slice(0, -1).join(PATH_SEP)
    parentFilename = parentRelFilename
    parentDirname = parentRelDirname
  } else {
    filename = __pathResolver.resolve(modulePathFromAppRoot)
    dirname = __pathResolver.resolve(
      filename.split(PATH_SEP).slice(0, -1).join(PATH_SEP)
    )
    parentFilename = __pathResolver.resolve(parentRelFilename)
    parentDirname = __pathResolver.resolve(parentRelDirname)
  }

  const parent = loader ?? {
    id: parentFilename,
    filename: parentFilename,
    path: parentDirname,
  }
  return { parent, filename, dirname }
}

function createResolveOpts(relFilename, relDirname) {
  const filename = __pathResolver.resolve(relFilename)
  const dirname = __pathResolver.resolve(relDirname)

  return {
    relFilename,
    relPath: relDirname,
    filename,
    path: dirname,
    fromSnapshot: true,
    isResolve: true,
  }
}

customRequire.resolve = function (mod, relFilename, relDirname) {
  try {
    const opts =
      relFilename != null && relDirname != null
        ? createResolveOpts(relFilename, relDirname)
        : undefined
    return require.resolve(mod, opts)
  } catch (err) {
    // console.error(err.toString())
    // console.error('Failed to resolve', mod)
    // debugger
    throw err
  }
}
//
// </custom-require>
//

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

  // Short circuit core modules
  if (
    !snapshotting &&
    require.builtInModules != null &&
    require.builtInModules.has(modulePath)
  ) {
    return require(modulePath)
  }
  // The relative path to the module is used to resolve modules from the various caches
  let key = modulePathFromAppRoot

  // Normalize path and key on Windows
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

  // This is a somewhat brittle attempt to resolve the parent if it is the receiver
  const loader /* NodeModule? */ =
    this != null && this !== global && this.id != null && this.filename != null
      ? this
      : undefined

  // Loaded from is used to signal to packherd how a module resolution should be counted
  let loadedFrom

  // First try to resolve the fully initialized module from the cache
  let mod = key == null ? null : customRequire.exports[key]
  if (mod != null) {
    // This is not very clean, but in order to create a proper module we need to
    // assume some path to base id, filename and dirname on
    if (modulePathFromAppRoot == null) {
      modulePathFromAppRoot = modulePath
    }
    // Create a parent as close as we can to what Node.js would provide
    const { parent, filename, dirname } = resolvePathsAndParent(
      snapshotting,
      modulePathFromAppRoot,
      parentRelFilename,
      parentRelDirname,
      loader
    )
    mod.parent = parent
    mod.id = filename
    mod.filename = filename
    mod.dirname = dirname
    loadedFrom = 'exports'
  }

  // There are two reasons why a module cannot be used from the cache
  // a) it wasn't found in the cache
  // b) it was found, but was deleted from the Node.js module cache and in order to
  //    have things work the same as without the snapshot we need to reload it
  const cannotUseCached =
    mod == null ||
    (!snapshotting &&
      typeof require.shouldBypassCache === 'function' &&
      require.shouldBypassCache(mod))

  if (cannotUseCached) {
    // Construct the module first
    if (modulePathFromAppRoot == null) {
      modulePathFromAppRoot = modulePath
    }
    const { parent, filename, dirname } = resolvePathsAndParent(
      snapshotting,
      modulePathFromAppRoot,
      parentRelFilename,
      parentRelDirname
    )

    mod = {
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

    // Then populate its exports if its definition is cached
    if (customRequire.definitions.hasOwnProperty(key)) {
      customRequire.exports[key] = mod
      customRequire.definitions[key].apply(mod.exports, [
        mod.exports,
        mod,
        filename,
        dirname,
        customRequire,
      ])
      loadedFrom = 'definitions'
    } else {
      try {
        if (!snapshotting) {
          // If not in definitions we need to load it another way, namely `_tryLoad` will resolve
          // it via Node.js `require`.
          loadedFrom = 'Counted already'
          const { exports, fullPath } = require._tryLoad(
            modulePath,
            parent,
            false
          )
          // If all went well the module should now be in the module cache, otherwise we
          // use the module we constructed above and fill in the exports
          const cachedMod = require.cache[fullPath]
          if (cachedMod != null) {
            mod = cachedMod
          } else {
            mod.exports = exports
          }
        } else {
          // While snapshotting we load the module and add it to the exports cache
          mod.exports = require(modulePath)
          customRequire.exports[modulePath] = mod
        }
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

  // Finally we need to register the module as loaded so that packherd can track which modules were
  // loaded and how. It will also add it to the require cache in order to
  // detect if a previously loaded module was deleted from the require cache later.
  if (typeof require.registerModuleLoad === 'function') {
    require.registerModuleLoad(mod, loadedFrom)
  }

  return mod.exports
}

customRequire.extensions = {}
customRequire.exports = {}

function resolvePathsAndParent(
  snapshotting,
  modulePathFromAppRoot,
  parentRelFilename,
  parentRelDirname,
  loader /* NodeModule? */
) {
  let filename, dirname, parentFilename, parentDirname

  if (modulePathFromAppRoot == null) {
    throw new Error('Cannot resolve paths without modulePathFromAppRoot')
  }

  if (snapshotting || !modulePathFromAppRoot.startsWith('.')) {
    filename = modulePathFromAppRoot
    dirname = filename.split(PATH_SEP).slice(0, -1).join(PATH_SEP)
    parentFilename = parentRelFilename
    parentDirname = parentRelDirname
  } else if (modulePathFromAppRoot != null) {
    filename = __pathResolver.resolve(modulePathFromAppRoot)
    dirname = __pathResolver.resolve(
      filename.split(PATH_SEP).slice(0, -1).join(PATH_SEP)
    )
    parentFilename = __pathResolver.resolve(parentRelFilename)
    parentDirname = __pathResolver.resolve(parentRelDirname)
  }
  const parent =
    loader ??
    (parentFilename == null || parentDirname == null
      ? null
      : {
          id: parentFilename,
          filename: parentFilename,
          path: parentDirname,
        })
  return { parent, filename, dirname }
}

function createResolveOpts(relFilename, relDirname) {
  const filename = __pathResolver.resolve(relFilename)
  const dirname = __pathResolver.resolve(relDirname)

  return {
    id: filename,
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

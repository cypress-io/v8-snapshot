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
  let key = modulePathFromAppRoot
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
  const loader /* NodeModule? */ =
    this !== global && this.id != null && this.filename != null
      ? this
      : undefined

  let mod
  mod = customRequire.exports[key]
  if (mod != null) {
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
  }

  const cannotUseCached =
    mod == null ||
    (!snapshotting &&
      typeof require.shouldBypassCache === 'function' &&
      require.shouldBypassCache(mod))

  if (cannotUseCached) {
    var { parent, filename, dirname } = resolvePathsAndParent(
      snapshotting,
      modulePathFromAppRoot ?? modulePath,
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

    if (customRequire.definitions.hasOwnProperty(key)) {
      customRequire.exports[key] = mod
      customRequire.definitions[key].apply(mod.exports, [
        mod.exports,
        mod,
        filename,
        dirname,
        customRequire,
      ])
    } else {
      try {
        // TODO: we get here for core modules, we should be able to shortcut this higher up
        if (!snapshotting) {
          const { exports, fullPath } = require._tryLoad(
            modulePath,
            parent,
            false
          )
          const cachedMod = require.cache[fullPath]
          if (cachedMod != null) {
            mod = cachedMod
          } else {
            mod.exports = exports
          }
        } else {
          mod.exports = require(modulePath)
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

  if (typeof require.registerModuleLoad === 'function') {
    require.registerModuleLoad(mod)
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

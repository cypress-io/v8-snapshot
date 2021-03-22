function setGlobals(
  newGlobal,
  newProcess,
  newWindow,
  newDocument,
  newConsole,
  newPathResolver,
  nodeRequire
) {
  // Populate the global function trampoline with the real global functions defined on newGlobal.
  globalFunctionTrampoline = newGlobal

  for (let key of Object.keys(global)) {
    newGlobal[key] = global[key]
  }

  global = newGlobal

  for (let key of Object.keys(process)) {
    newProcess[key] = process[key]
  }

  process = newProcess

  for (let key of Object.keys(window)) {
    newWindow[key] = window[key]
  }

  window = newWindow

  for (let key of Object.keys(document)) {
    newDocument[key] = document[key]
  }

  document = newDocument

  for (let key of Object.keys(console)) {
    newConsole[key] = console[key]
  }

  console = newConsole
  __pathResolver = newPathResolver
  require = nodeRequire
}

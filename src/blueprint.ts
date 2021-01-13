import fs from 'fs'

function read(part: string, indent = '  ') {
  const p = require.resolve(`./blueprint/${part}`)
  const s = fs.readFileSync(p, 'utf8')
  return s.split('\n').join(`\n${indent}`)
}

const globals = read('globals')
const strictGlobals = read('globals-strict')
const customRequire = read('custom-require')
const setGlobals = read('set-globals')

export type BlueprintConfig = {
  processPlatform: string
  processNodeVersion: string
  mainModuleRequirePath: string
  auxiliaryData: string
  customRequireDefinitions: string
  includeStrictVerifiers: boolean
}
export function scriptFromBlueprint(config: BlueprintConfig) {
  const {
    processPlatform,
    processNodeVersion,
    mainModuleRequirePath,
    auxiliaryData,
    customRequireDefinitions,
    includeStrictVerifiers,
  } = config

  // TODO: NODE_ENV needs to be configurable
  return `
// vim: set ft=text:
var snapshotAuxiliaryData = ${auxiliaryData}

function generateSnapshot() {
  //
  // <process>
  //
  function cannotAccess(proto, prop) {
    return function () {
      throw 'Cannot access ' + proto + '.' + prop + ' during snapshot creation'
    }
  }
  function getPrevent(proto, prop) {
    return {
      get: cannotAccess(proto, prop)
    }
  }

  let process = {}
  Object.defineProperties(process, {
    platform: {
      value: '${processPlatform}',
      enumerable: false,
    },
    argv: {
      value: [],
      enumerable: false,
    },
    env: {
      value: {
        NODE_ENV: 'production',
      },
      enumerable: false,
    },
    version: {
      value: '${processNodeVersion}',
      enumerable: false,
    },
    versions: {
      value: { node: '${processNodeVersion}' },
      enumerable: false,
    },
    nextTick: getPrevent('process', 'nextTick')
  })

  function get_process() {
    return process
  }
  //
  // </process>
  //

  ${globals}
  ${includeStrictVerifiers ? strictGlobals : ''}

  const coreStubs = {
  }

  ${customRequire}
  ${customRequireDefinitions}

  customRequire(${mainModuleRequirePath})
  return {
    customRequire,
    setGlobals: ${setGlobals},
  }
}

snapshotAuxiliaryData.snapshotSections = []
var snapshotResult = generateSnapshot.call({})

generateSnapshot = null
`
}

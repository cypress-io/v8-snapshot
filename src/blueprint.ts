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
    // HACK(thlorenz): it seems this is a valid way to defer access to the _actual_ process Object?
    // This makes cases work that check for 'typeof process.nextTick === 'function'' or similar and
    // is replaced by the _real_ process 'nextTick' at runtime.
    // Need to ensure that either no code holds on to the 'nextTick' instance and/or that those cases
    // don't break.
    nextTick: {
      value: (cb, ...args) => { 
        throw new Error('CANNOT USE FAKE TICK FUNCTION')
      },
      enumerable: false,
    }
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

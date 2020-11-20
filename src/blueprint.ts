import fs from 'fs'

function read(part: string, indent = '  ') {
  const p = require.resolve(`./blueprint/${part}`)
  const s = fs.readFileSync(p, 'utf8')
  return s.split('\n').join(`\n${indent}`)
}

const globals = read('globals')
const coreUtil = read('core-util')
const coreEvents = read('core-events')
const customRequire = read('custom-require')
const setGlobals = read('set-globals')
const translateSnapshotRow = read('translate-snapshot-row')

export type BlueprintConfig = {
  processPlatform: string
  processNodeVersion: string
  mainModuleRequirePath: string
  auxiliaryData: string
  customRequireDefinitions: string
}
export function scriptFromBlueprint(config: BlueprintConfig) {
  const {
    processPlatform,
    processNodeVersion,
    mainModuleRequirePath,
    auxiliaryData,
    customRequireDefinitions,
  } = config

  return `
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
  })

  function get_process() {
    return process
  }
  //
  // </process>
  //

  ${globals}

  ${coreUtil}
  ${coreEvents}

  const coreStubs = {
    util: coreUtil(),
    events: coreEvents(),
  }

  ${customRequire}
  ${customRequireDefinitions}

  customRequire(${mainModuleRequirePath})
  return {
    customRequire,
    setGlobals: ${setGlobals},
    translateSnapshotRow: ${translateSnapshotRow},
  }
}

snapshotAuxiliaryData.snapshotSections = []
var snapshotResult = generateSnapshot.call({})

generateSnapshot = null
`
}

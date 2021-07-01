import fs from 'fs'
import { BUNDLE_WRAPPER_OPEN } from './create-snapshot-script'
import { inlineSourceMapComment } from './sourcemap/inline-sourcemap'
import { processSourceMap } from './sourcemap/process-sourcemap'

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
  customRequireDefinitions: Buffer
  includeStrictVerifiers: boolean
  nodeEnv: string
  basedir: string
  sourceMap: Buffer | undefined
}

export function scriptFromBlueprint(config: BlueprintConfig) {
  const {
    processPlatform,
    processNodeVersion,
    mainModuleRequirePath,
    auxiliaryData,
    customRequireDefinitions,
    includeStrictVerifiers,
    nodeEnv,
    basedir,
    sourceMap,
  } = config

  const wrapperOpen = Buffer.from(
    `
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
        NODE_ENV: '${nodeEnv}',
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
`,
    'utf8'
  )
  const wrapperClose = Buffer.from(
    `
  ${customRequire}
  ${includeStrictVerifiers ? 'require.isStrict = true' : ''}

  customRequire(${mainModuleRequirePath})
  return {
    customRequire,
    setGlobals: ${setGlobals},
  }
}
var snapshotResult = generateSnapshot.call({})
generateSnapshot = null
`,
    'utf8'
  )

  const buffers = [wrapperOpen, customRequireDefinitions, wrapperClose]

  // Now we rendered the prelude and can calculate the bundle line offset and thus
  // process and include source maps. Since it is expensive we only do this if we
  // have a valid sourcemap.
  let offsetToBundle: number | undefined = undefined

  let processedSourceMap: string | undefined
  if (sourceMap != null) {
    offsetToBundle =
      newLinesInBuffer(wrapperOpen) + newLinesInBuffer(BUNDLE_WRAPPER_OPEN) + 1

    processedSourceMap = processSourceMap(sourceMap, basedir, offsetToBundle)

    // Embed the sourcemaps as a JS object for fast retrieval
    if (processedSourceMap != null) {
      buffers.push(
        Buffer.from(
          `snapshotAuxiliaryData.sourceMap = ${processedSourceMap}`,
          'utf8'
        )
      )
    }

    // Inline the sourcemap comment (even though DevTools doesn't properly pick that up)
    const sourceMapComment = inlineSourceMapComment(processedSourceMap)
    if (sourceMapComment != null) {
      buffers.push(Buffer.from(sourceMapComment, 'utf8'))
    }
  }
  return { script: Buffer.concat(buffers), processedSourceMap }
}

const CR_CODE = '\n'.charCodeAt(0)

function newLinesInBuffer(buf: Buffer) {
  const newLines = buf.filter((x) => x === CR_CODE)
  return newLines.length
}

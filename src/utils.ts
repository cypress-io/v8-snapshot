import { blueBright, gray, green, yellow } from 'ansi-colors'
import fs from 'fs'
import path, { join, resolve } from 'path'

function canAccessSync(p: string) {
  try {
    fs.accessSync(p)
    return true
  } catch (_) {
    return false
  }
}

export function ensureDirSync(dir: string) {
  if (!canAccessSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    return
  }
  // dir already exists, make sure it isn't a file
  const stat = fs.statSync(dir)
  if (!stat.isDirectory()) {
    throw new Error(`'${dir}' is not a directory`)
  }
}

export function checkFileSync(p: string) {
  if (!canAccessSync(p)) throw new Error(`Unable to find '${p}'`)
  const stat = fs.statSync(p)
  if (!stat.isFile()) throw new Error(`${p} is not a file`)
}

export function checkDirSync(p: string) {
  if (!canAccessSync(p)) throw new Error(`Unable to find '${p}'`)
  const stat = fs.statSync(p)
  if (!stat.isDirectory()) throw new Error(`${p} is not a directory`)
}

export function fileExistsSync(p: string) {
  try {
    checkFileSync(p)
    return true
  } catch (_) {
    return false
  }
}

export function findMksnapshot(root: string) {
  const p = resolve(
    root,
    'node_modules',
    '.bin',
    'mksnapshot' + (process.platform === 'win32' ? '.cmd' : '')
  )
  checkFileSync(p)
  return p
}

export function eletronSnapshotPath(root: string) {
  const electron = resolve(root, 'node_modules', 'electron')
  let location
  switch (process.platform) {
    case 'darwin': {
      location =
        'dist/Electron.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Resources'
      break
    }
    case 'win32':
    case 'linux':
    case 'openbsd':
    case 'sunos':
    case 'win32':
    case 'cygwin':
    case 'netbsd': {
      location = 'dist'
      break
    }

    default: {
      throw new Error(`Platform not supported ${process.platform}`)
    }
  }

  const snapshotLocation = join(electron, location)
  return join(snapshotLocation, 'v8_context_snapshot.bin')
}
// at Object.__commonJS../node_modules/mute-stream/mute.js (/Volumes/d/dev/cy/perf-tr1/v8-snapshot-utils/example-multi/cache/snapshot.js:10555:43)
const commonJsModuleRx = /(at Object.__commonJS\.)([^(]+)([^ :]+) *:(\d+)(.+)/
export function prettyPrintError(err: Error, baseDirPath: string) {
  if (!err.message.includes('Cannot require module') || err.stack == null) {
    console.error(err)
    return
  }
  console.error(err.message)
  const frames = err.stack.split('\n')

  const locations = []
  const prettyFrames = []
  for (const frame of frames) {
    const match = frame.match(commonJsModuleRx)
    if (match == null) {
      prettyFrames.push(frame)
      continue
    }
    const parts = {
      atObject: match[1],
      requireString: match[2].trimEnd(),
      snapshotPath: match[3],
      lineno: match[4],
      rest: match[5],
    }
    prettyFrames.push(
      `${gray(parts.atObject)} ${green(parts.requireString)}` +
        `${gray(parts.snapshotPath)}` +
        `:${blueBright(parts.lineno)}${gray(')')}`
    )
    const fullPath = path.resolve(baseDirPath, parts.requireString)
    locations.push(
      `${parts.requireString} ${gray('at snapshot:' + parts.lineno)} (${gray(
        fullPath
      )})`
    )
  }
  console.error(prettyFrames.join('\n'))

  console.error(yellow('\nRequire Definitions Stack:'))
  console.error('  %s', green(locations.join('\n  ')))
}

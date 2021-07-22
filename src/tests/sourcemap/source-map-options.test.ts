// import spok from 'spok'
import path from 'path'
import test, { Test } from 'tape'
import { readSnapshotResult } from '../utils/bundle'
import { SnapshotGenerator } from '../../snapshot-generator'

function assertMappingUrl(t: Test, sourcemapComment: string | undefined) {
  t.equal(
    sourcemapComment,
    '// #sourceMappingUrl=cache/snapshot.js.map',
    'sourceMappingUrl to map file'
  )
}

function assertInlined(t: Test, sourcemapComment: string | undefined) {
  t.ok(
    sourcemapComment?.startsWith(
      '//# sourceMappingURL=data:application/json;base64'
    ),
    'sourceMappingUrl inlined'
  )
}

function assertEmbedded(t: Test, snapshotAuxiliaryData: any) {
  t.deepEqual(
    Object.keys(snapshotAuxiliaryData.sourceMap),
    [
      'version',
      'sources',
      'names',
      'mappings',
      'file',
      'sourceRoot',
      'sourcesContent',
    ],
    'embedded sourcemap'
  )
}

const projectBaseDir = path.join(__dirname, 'fixtures', 'minimal')
const cacheDir = path.join(projectBaseDir, 'cache')
const snapshotEntryFile = path.join(projectBaseDir, 'entry.js')

test('sourcemap: not inlining nor embedding sourcemap', async (t) => {
  const generator = new SnapshotGenerator(projectBaseDir, snapshotEntryFile, {
    cacheDir,
    nodeModulesOnly: false,
  })
  await generator.createScript()
  const { snapshotAuxiliaryData, sourcemapComment } =
    readSnapshotResult(cacheDir)

  assertMappingUrl(t, sourcemapComment)
  t.equal(snapshotAuxiliaryData.sourceMap, undefined, 'no embedded sourcemap')

  t.end()
})

test('sourcemap: inlining but not embedding sourcemap', async (t) => {
  const generator = new SnapshotGenerator(projectBaseDir, snapshotEntryFile, {
    cacheDir,
    nodeModulesOnly: false,
    sourcemapInline: true,
  })
  await generator.createScript()
  const { snapshotAuxiliaryData, sourcemapComment } =
    readSnapshotResult(cacheDir)

  assertInlined(t, sourcemapComment)

  t.equal(snapshotAuxiliaryData.sourceMap, undefined, 'no embedded sourcemap')

  t.end()
})

test('sourcemap: embedding but not inlining sourcemap', async (t) => {
  const generator = new SnapshotGenerator(projectBaseDir, snapshotEntryFile, {
    cacheDir,
    nodeModulesOnly: false,
    sourcemapEmbed: true,
  })
  await generator.createScript()
  const { snapshotAuxiliaryData, sourcemapComment } =
    readSnapshotResult(cacheDir)

  assertMappingUrl(t, sourcemapComment)
  assertEmbedded(t, snapshotAuxiliaryData)

  t.end()
})

test('sourcemap: embedding and inlining sourcemap', async (t) => {
  const generator = new SnapshotGenerator(projectBaseDir, snapshotEntryFile, {
    cacheDir,
    nodeModulesOnly: false,
    sourcemapEmbed: true,
    sourcemapInline: true,
  })
  await generator.createScript()
  const { snapshotAuxiliaryData, sourcemapComment } =
    readSnapshotResult(cacheDir)

  assertInlined(t, sourcemapComment)
  assertEmbedded(t, snapshotAuxiliaryData)

  t.end()
})

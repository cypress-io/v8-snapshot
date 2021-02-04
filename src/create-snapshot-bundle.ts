import {
  CreateSnapshotScriptOpts,
  createBundleAsync,
} from './create-snapshot-script'
import { Metadata } from './types'

const prelude = `function get_process() {
  if (typeof process === 'undefined') return undefined
  return process
}
function get_document() {
  if (typeof document === 'undefined') return undefined
  return document
}

function get_global() {
  if (typeof global === 'undefined') return undefined
  return global
}

function get_window() {
  if (typeof window === 'undefined') return undefined
  return window
}

function get_console() {
  if (typeof console === 'undefined') return undefined
  return console
}
`

const postlude = `
module.exports = __commonJS`

/** Similar to @see createSnapshotScript, but creates a bundle instead which provides all
 *  definitions via its export.
 *  This is mostly used when diagnosing/debugging why a particular snapshot script has problems.
 *
 * @param opts
 * @return the paths and contents of the originally created bundle and related metadata
 * as well as the version which includes module exports.
 */
export async function createExportScript(
  opts: CreateSnapshotScriptOpts
): Promise<{ snapshotBundle: string; meta: Metadata; bundle: string }> {
  const { bundle, meta } = await createBundleAsync(opts)
  const snapshotBundle = `${prelude}
${bundle}
${postlude}`

  return { snapshotBundle, meta, bundle }
}

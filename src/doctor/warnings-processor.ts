import type { CreateBundleResult } from 'packherd'
import path from 'path'

export const SNAPSHOT_REWRITE_FAILURE = '[SNAPSHOT_REWRITE_FAILURE]'
export const UNKNOWN = 'UNKNOWN'

export enum WarningConsequence {
  Defer,
  NoRewrite,
  None,
}

export type Warning = CreateBundleResult['warnings'][number]
export type ProcessedWarning = {
  type: typeof SNAPSHOT_REWRITE_FAILURE | typeof UNKNOWN
  location: Warning['location'] & { fullPath: string }
  consequence: WarningConsequence
  text: Warning['text']
}

export function stringifyWarning(warning: ProcessedWarning) {
  const loc = warning.location
  return `
    ${warning.text} at ${loc.fullPath}:${loc.line}:${loc.column} (${loc.file}

      ${warning.location.lineText}
  `
}

export class WarningsProcessor {
  constructor(private readonly _projectBasedir: string) {}

  public process(warnings: Warning[]): ProcessedWarning[] {
    return warnings
      .map(this._processWarning)
      .filter((x) => x != null) as ProcessedWarning[]
  }

  private _processWarning = (warning: Warning): ProcessedWarning | null => {
    // We cannot do anything useful if we don't know what file the warning pertains to
    if (warning.location == null) return null
    const fullPath = path.resolve(this._projectBasedir, warning.location.file)
    const location = Object.assign({}, warning.location, { fullPath })
    const text = warning.text

    if (warning.text.includes(SNAPSHOT_REWRITE_FAILURE)) {
      return {
        type: SNAPSHOT_REWRITE_FAILURE,
        location,
        text,
        consequence: WarningConsequence.NoRewrite,
      }
    }
    // We don't know what this warning means, just pass it along with no consequence
    return {
      type: UNKNOWN,
      location,
      text,
      consequence: WarningConsequence.None,
    }
  }
}

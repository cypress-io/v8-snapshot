import type { CreateBundleResult } from 'packherd'
import path from 'path'

export const SNAPSHOT_REWRITE_FAILURE = '[SNAPSHOT_REWRITE_FAILURE]'
export const SNAPSHOT_CACHE_FAILURE = '[SNAPSHOT_CACHE_FAILURE]'
export const UNKNOWN = 'UNKNOWN'

export enum WarningConsequence {
  Defer,
  NoRewrite,
  None,
}

export type Warning = CreateBundleResult['warnings'][number]
export type ProcessedWarning = {
  location: Warning['location'] & { fullPath: string }
  consequence: WarningConsequence
  text: Warning['text']
}

export function stringifyWarning(
  projectBaseDir: string,
  warning: ProcessedWarning
) {
  const loc = warning.location
  const p = path.relative(projectBaseDir, loc.fullPath)
  return `
    ${warning.text} at ./${p}:${loc.line}:${loc.column} (${loc.file})
      | ${loc.line} ${warning.location.lineText}
      | ${' '.repeat(loc.column + loc.line.toString().length)} ^
  `
}

export class WarningsProcessor {
  constructor(
    private readonly _projectBasedir: string,
    private readonly _warningsWithoutConsequenceReported: Set<string> = new Set()
  ) {}

  public process({
    warnings,
    deferred,
    norewrite,
  }: {
    warnings: Warning[]
    deferred: Set<string>
    norewrite: Set<string>
  }): ProcessedWarning[] {
    return warnings.map(this._processWarning).filter((x): boolean => {
      if (x == null) return false
      switch (x.consequence) {
        case WarningConsequence.Defer: {
          if (deferred.has(x.location.file)) return false
          break
        }
        case WarningConsequence.NoRewrite: {
          if (norewrite.has(x.location.file)) return false
          break
        }
        case WarningConsequence.None: {
          if (this._warningsWithoutConsequenceReported.has(x.location.file))
            return false
          this._warningsWithoutConsequenceReported.add(x.location.file)
          break
        }
      }
      return true
    }) as ProcessedWarning[]
  }

  private _processWarning = (warning: Warning): ProcessedWarning | null => {
    // We cannot do anything useful if we don't know what file the warning pertains to
    if (warning.location == null) return null
    const fullPath = path.resolve(this._projectBasedir, warning.location.file)
    const location = Object.assign({}, warning.location, { fullPath })
    const text = warning.text

    // prettier-ignore
    const consequence = 
        warning.text.includes(SNAPSHOT_REWRITE_FAILURE) ? WarningConsequence.NoRewrite
      : warning.text.includes(SNAPSHOT_CACHE_FAILURE)   ? WarningConsequence.Defer
        // We don't know what this warning means, just pass it along with no consequence
      : WarningConsequence.None

    return {
      location,
      text,
      consequence,
    }
  }
}

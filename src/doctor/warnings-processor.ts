import type { CreateBundleResult } from 'packherd'
import path from 'path'

export const SNAPSHOT_REWRITE_FAILURE = '[SNAPSHOT_REWRITE_FAILURE]'
export const SNAPSHOT_CACHE_FAILURE = '[SNAPSHOT_CACHE_FAILURE]'
export const TYPE_ERROR = 'TypeError:'
export const REFERENCE_ERROR = 'ReferenceError:'
export const UNKNOWN = 'UNKNOWN'

export type WarningsProcessHistory = {
  deferred: Set<string>
  norewrite: Set<string>
}

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

  public process(
    warnings: Warning[],
    hist: WarningsProcessHistory
  ): ProcessedWarning[] {
    return warnings
      .map((x) => this._processWarning(x, hist))
      .filter(
        (x: ProcessedWarning | null): boolean => x != null
      ) as ProcessedWarning[]
  }

  private _processWarning(
    warning: Omit<Warning, 'detail' | 'notes'>,
    hist: WarningsProcessHistory
  ): ProcessedWarning | null {
    // We cannot do anything useful if we don't know what file the warning pertains to
    if (warning.location == null) return null
    const fullPath = path.resolve(this._projectBasedir, warning.location.file)
    const location = Object.assign({}, warning.location, { fullPath })
    const text = warning.text

    // prettier-ignore
    const consequence = 
           text.includes(SNAPSHOT_REWRITE_FAILURE) 
        || text.includes(TYPE_ERROR)                ? WarningConsequence.NoRewrite
      :    text.includes(SNAPSHOT_CACHE_FAILURE)      
        || text.includes(REFERENCE_ERROR)           ? WarningConsequence.Defer
      : WarningConsequence.None

    // We don't know what this warning means, just pass it along with no consequence
    return this._nullIfAlreadyProcessed(
      {
        location,
        text,
        consequence,
      },
      hist
    )
  }

  private _nullIfAlreadyProcessed(
    x: ProcessedWarning,
    { deferred, norewrite }: WarningsProcessHistory
  ) {
    if (x == null) return null
    switch (x.consequence) {
      case WarningConsequence.Defer: {
        if (deferred.has(x.location.file)) return null
        return x
      }
      case WarningConsequence.NoRewrite: {
        if (norewrite.has(x.location.file)) return null
        return x
      }
      case WarningConsequence.None: {
        if (this._warningsWithoutConsequenceReported.has(x.location.file))
          return null
        this._warningsWithoutConsequenceReported.add(x.location.file)
        return x
      }
    }
  }

  warningFromError(err: Error, file: string, hist: WarningsProcessHistory) {
    let location: Warning['location'] = {
      file,
      namespace: 'file:',
      line: 1,
      column: 0,
      length: 0,
      lineText: '<unknown>',
    }
    let text = err.toString()

    let warning: Omit<Warning, 'detail' | 'notes'> = { location, text }
    return this._processWarning(warning, hist)
  }
}

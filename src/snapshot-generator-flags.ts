/**
 * Bitwise flags which means they can be combined, i.e. `Flags.Script | Flags.DoctorFresh`
 */
// prettier-ignore
export enum Flag {
  None                 = 0x0000,
  Script               = 0x0001,
  MakeSnapshot         = 0x0002,
  ReuseDoctorArtifacts = 0x0004,
}

export class GeneratorFlags {
  constructor(private flags: Flag) {}

  public has(flag: number): boolean {
    return !!(this.flags & flag)
  }

  public add(flag: Flag) {
    this.flags |= flag
  }

  public delete(flag: Flag) {
    this.flags &= ~flag
  }
}

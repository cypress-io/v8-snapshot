import vm from 'vm'

export class SnapshotVerifier {
  verify(snapshotScript: Buffer, filename: string) {
    vm.runInNewContext(snapshotScript.toString(), undefined, {
      filename,
      displayErrors: true,
    })
  }
}

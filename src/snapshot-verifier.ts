import vm from 'vm'

export class SnapshotVerifier {
  verify(snapshotScript: string, filename: string) {
    vm.runInNewContext(snapshotScript, undefined, {
      filename,
      displayErrors: true,
    })
  }
}

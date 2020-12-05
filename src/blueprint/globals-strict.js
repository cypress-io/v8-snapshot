//
// <globals-strict>
//

// The below is only included when verifying the snapshot.
// When generating a snapshot to feed to mksnapshot they cannot
// be included as then they'd modify the environment when running the
// snapshotted application.

// TODO: possibly store original error and use it to throw below or throw a string (for now a workaround was added when
// logging errors originiting from the vm )
function cannotAccess(proto, prop) {
  return function () {
    throw new Error(`Cannot access ${proto}.${prop} during snapshot creation`)
  }
}

Object.defineProperties(Error, {
  captureStackTrace: { value: cannotAccess('Error', 'captureStackTrace') },
  stackTraceLimit: { get: cannotAccess('Error', 'stackTraceLimit') },
  name: { get: cannotAccess('Error', 'name') },
})

//
// </globals-strict>
//

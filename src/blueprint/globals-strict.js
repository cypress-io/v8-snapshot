//
// <globals-strict>
//

// The below is only included when verifying the snapshot.
// When generating a snapshot to feed to mksnapshot they cannot
// be included as then they'd modify the environment when running the
// snapshotted application.

function cannotAccess(proto, prop) {
  return function () {
    throw new GLOBAL.Error(
      `Cannot access ${proto}.${prop} during snapshot creation`
    )
  }
}

// let Error = {}
Object.defineProperties(Error, {
  captureStackTrace: { value: cannotAccess('Error', 'captureStackTrace') },
  stackTraceLimit: { get: cannotAccess('Error', 'stackTraceLimit') },
  name: { get: cannotAccess('Error', 'name') },
})

//
// </globals-strict>
//

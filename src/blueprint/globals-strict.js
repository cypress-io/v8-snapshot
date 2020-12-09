//
// <globals-strict>
//

// The below is only included when verifying the snapshot.
// When generating a snapshot to feed to mksnapshot they cannot
// be included as then they'd modify the environment when running the
// snapshotted application.

function cannotAccess(proto, prop) {
  return function () {
    throw `Cannot access ${proto}.${prop} during snapshot creation`
  }
}

//
// Error
//
Object.defineProperties(Error, {
  captureStackTrace: { value: cannotAccess('Error', 'captureStackTrace') },
  stackTraceLimit: { get: cannotAccess('Error', 'stackTraceLimit') },
  name: { get: cannotAccess('Error', 'name') },
})

//
// Promise
//
const promiseProperties = [
  'all',
  'allSettled',
  'race',
  'reject',
  'resolve',
].reduce((acc, key) => {
  acc[key] = { value: cannotAccess('Promise', key) }
  return acc
}, {})
Object.defineProperties(Promise, promiseProperties)

//
// </globals-strict>
//

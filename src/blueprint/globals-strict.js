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

function getsetPrevent(proto, prop) {
  return {
    get: cannotAccess(proto, `${prop} getter`),
    set: cannotAccess(proto, `${prop} setter`),
  }
}

function proxyPrevent(item, { construction }) {
  const key = item.prototype.constructor.name
  const proxyHandler = {}

  if (construction) {
    proxyHandler.construct = cannotAccess(key, 'constructor')
  }

  return new Proxy(item, proxyHandler)
}

//
// Error
//
Object.defineProperties(Error, {
  captureStackTrace: { value: cannotAccess('Error', 'captureStackTrace') },
  stackTraceLimit: getsetPrevent('Error', 'stackTraceLimit'),
  prepareStackTrace: getsetPrevent('Error', 'prepareStackTrace'),
  name: getsetPrevent('Error', 'name'),
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
// Arrays
//

const arrayPreventors = { construction: true }
Uint8Array = proxyPrevent(Uint8Array, arrayPreventors)
Uint16Array = proxyPrevent(Uint16Array, arrayPreventors)
Uint32Array = proxyPrevent(Uint32Array, arrayPreventors)
Uint8ClampedArray = proxyPrevent(Uint8ClampedArray, arrayPreventors)
Int8Array = proxyPrevent(Int8Array, arrayPreventors)
Int16Array = proxyPrevent(Int16Array, arrayPreventors)
Int32Array = proxyPrevent(Int32Array, arrayPreventors)
Array = proxyPrevent(Array, arrayPreventors)

//
// </globals-strict>
//

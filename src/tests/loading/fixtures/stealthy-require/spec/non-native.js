'use strict'

const test = require('tape')
const stealthyRequire = require('stealthy-require')

test('should require a module without deps', (t) => {
  var req1 = require('../fixtures/no-deps.js')
  var req2 = stealthyRequire(require.cache, function () {
    return require('../fixtures/no-deps.js')
  })
  var req3 = require('../fixtures/no-deps.js')

  t.equal(req1, req3)
  t.notEqual(req1, req2)
  t.equal(req1, req2)

  t.end()
})

/*
test('should require a module with sync deps', (t) => {
  var req1 = require('../fixtures/sync-deps.js')
  var req2 = stealthyRequire(require.cache, function () {
    return require('../fixtures/sync-deps.js')
  })
  var req3 = require('../fixtures/sync-deps.js')

  expect(req1).to.eql(req3)
  expect(req1).to.not.eql(req2)
})

test('should require a module with the exception of async deps', (t) => {
  var req1 = require('../fixtures/async-deps.js')
  var req2 = stealthyRequire(require.cache, function () {
    return require('../fixtures/async-deps.js')
  })
  var req3 = require('../fixtures/async-deps.js')

  expect(req1).to.eql(req3)
  expect(req1.me).to.not.eql(req2.me)
  expect(req1.sync_dep).to.not.eql(req2.sync_dep)
  expect(req1.async_dep).to.eql(req2.async_dep) // <-- exception
})

test('should require a module while keeping a dependency that was required before', (t) => {
  var req1 = require('../fixtures/sync-deps.js')
  var lenChildrenBeforeReq2 = module.children.length
  var req2 = stealthyRequire(
    require.cache,
    function () {
      return require('../fixtures/deep-sync-deps.js')
    },
    function () {
      require('../fixtures/sync-deps.js')
    },
    module
  )
  var lenChildrenAfterReq2 = module.children.length
  var req3 = require('../fixtures/sync-deps.js')

  expect(req1).to.eql(req3)
  expect(req1).to.eql(req2.dep)
  expect(req1.dep).to.eql(req2.dep.dep)

  expect(lenChildrenAfterReq2).to.eql(lenChildrenBeforeReq2 + 1)
})

test('should require a module while keeping a dependency that will be required afterwards', (t) => {
  var testReq1 = require('../fixtures/sync-deps.js')
  var testReq2 = require('../fixtures/no-deps.js')
  delete require.cache[require.resolve('../fixtures/sync-deps.js')]
  delete require.cache[require.resolve('../fixtures/no-deps.js')]
  var testReq3 = require('../fixtures/sync-deps.js')
  var testReq4 = require('../fixtures/no-deps.js')
  expect(testReq1).to.not.eql(testReq3)
  expect(testReq2).to.not.eql(testReq4)

  delete require.cache[require.resolve('../fixtures/sync-deps.js')]
  delete require.cache[require.resolve('../fixtures/no-deps.js')]

  var lenChildrenBeforeReq2 = module.children.length
  var req2 = stealthyRequire(
    require.cache,
    function () {
      return require('../fixtures/deep-sync-deps.js')
    },
    function () {
      require('../fixtures/sync-deps.js')
    },
    module
  )
  var lenChildrenAfterReq2 = module.children.length
  var req3 = require('../fixtures/sync-deps.js')

  expect(req3).to.eql(req2.dep)
  expect(req3.dep).to.eql(req2.dep.dep)

  expect(lenChildrenAfterReq2).to.eql(lenChildrenBeforeReq2 + 1)
})

test('should not pollute require cache with dependencies that should be kept but are never required', (t) => {
  var testReq1 = require('../fixtures/sync-deps.js')
  var testReq2 = require('../fixtures/no-deps.js')
  delete require.cache[require.resolve('../fixtures/sync-deps.js')]
  delete require.cache[require.resolve('../fixtures/no-deps.js')]
  var testReq3 = require('../fixtures/sync-deps.js')
  var testReq4 = require('../fixtures/no-deps.js')
  expect(testReq1).to.not.eql(testReq3)
  expect(testReq2).to.not.eql(testReq4)

  delete require.cache[require.resolve('../fixtures/sync-deps.js')]
  delete require.cache[require.resolve('../fixtures/no-deps.js')]

  stealthyRequire(
    require.cache,
    function () {
      return require('../fixtures/no-deps.js')
    },
    function () {
      require('../fixtures/sync-deps.js')

      expect(
        require.cache[require.resolve('../fixtures/sync-deps.js')]
      ).to.not.eql(undefined)
      expect(
        Object.prototype.hasOwnProperty.call(
          require.cache,
          require.resolve('../fixtures/sync-deps.js')
        )
      ).to.eql(true)
    },
    module
  )

  expect(require.cache[require.resolve('../fixtures/sync-deps.js')]).to.eql(
    undefined
  )
  expect(
    Object.prototype.hasOwnProperty.call(
      require.cache,
      require.resolve('../fixtures/sync-deps.js')
    )
  ).to.eql(false)
})
*/

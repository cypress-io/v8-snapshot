const valid = require('./valid-module')
const invalid = require('./invalid-module')

function entry() {
  return valid() + invalid()
}

module.exports = entry

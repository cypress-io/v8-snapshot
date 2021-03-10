const valid = require('./valid-module')
const invalid = require('./using-dirname')

function entry() {
  return valid() + invalid()
}

module.exports = entry

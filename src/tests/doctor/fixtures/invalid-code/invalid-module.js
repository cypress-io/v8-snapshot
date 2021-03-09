const fs = require('fs')
function invalid() {
  fs = function () {}
  return 2
}

module.exports = invalid

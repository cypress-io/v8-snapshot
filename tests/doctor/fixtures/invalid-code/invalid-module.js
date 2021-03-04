// The below re-assignment is rewritten to something similar to:
//
// (get_console()) = function () {}
//
// This is invalid code and should lead to the file being excluded
// from the snapshot as well as the definitions
function invalid() {
  if (typeof console == 'undefined') {
    console = function () {}
  }
  return 1
}

module.exports = invalid

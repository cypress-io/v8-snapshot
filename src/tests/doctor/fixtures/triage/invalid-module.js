function invalid() {
  if (typeof console == 'undefined') {
    console = function () {}
  }
}

module.exports = invalid

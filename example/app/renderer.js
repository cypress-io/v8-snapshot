require('../../').snapshotRequire(require.resolve('../package.json'))
const React = require('react')
const ReactDOM = require('react-dom')

ReactDOM.render(
  React.createElement('div', null, `Hello React World!`),
  window.document.getElementById('app')
)

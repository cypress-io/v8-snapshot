const path = require('path')
const projectBaseDir = path.resolve(__dirname, '..')
const _ = require('../../').snapshotRequire(projectBaseDir)

const React = require('react')
const ReactDOM = require('react-dom')

if (!global.isGeneratingSnapshot) {
  ReactDOM.render(
    React.createElement('div', null, `Hello React World!`),
    window.document.getElementById('app')
  )
}

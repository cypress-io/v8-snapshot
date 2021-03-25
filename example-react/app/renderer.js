const React = require('react')
const ReactDOM = require('react-dom')

if (!global.isGeneratingSnapshot) {
  ReactDOM.render(
    React.createElement('div', null, `Hello React World!`),
    window.document.getElementById('app')
  )
}

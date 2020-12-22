const { app, BrowserWindow } = require('electron')

global.index = process.index = 'SET_INDEX'
if (typeof snapshotResult !== 'undefined') {
  snapshotResult.index = global.index
}
require('./log-process-info')('./index')

const path = require('path')
const projectBaseDir = path.resolve(__dirname, '..')
const _ = require('../../').snapshotRequire(projectBaseDir)

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    },
  })
  win.loadFile('index.html')
  win.toggleDevTools()
  require('./log-process-info')('./index')
}

app.whenReady().then(createWindow)

const { app, BrowserWindow } = require('electron')

if (typeof snapshotResult !== 'undefined') {
  console.log('snapshot result:\n', snapshotResult)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })
  win.loadFile('index.html')
  win.toggleDevTools()
}

if (app != null) {
  app.whenReady().then(createWindow)
}

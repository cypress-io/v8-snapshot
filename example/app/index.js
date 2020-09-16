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
    },
  })
  win.loadFile('index.html')
}

app.whenReady().then(createWindow)

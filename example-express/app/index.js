const { app, BrowserWindow } = require('electron')

let express

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

  loadExpress()
  launchExpress()
}

if (app != null) {
  app.whenReady().then(createWindow)
} else {
  loadExpress()
  launchExpress()
}

function loadExpress() {
  console.time('init-express')
  console.time('load-express')
  express = require('express')
  console.timeEnd('load-express')
}

function launchExpress() {
  const app = express()
  const port = 3000
  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
    console.timeEnd('init-express')
  })
}

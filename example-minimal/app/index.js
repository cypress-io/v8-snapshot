const { app, BrowserWindow } = require('electron')

const isObject = require('isobject')
const tmpfile = require('tmpfile')

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

  console.log({
    isTmpFileObject: isObject(tmpfile),
    isTmpModuleObject: isObject(module),
  })
}

if (app != null) {
  app.whenReady().then(createWindow)
} else {
  console.log({
    isTmpFileObject: isObject(tmpfile),
    isTmpModuleObject: isObject(module),
  })
}

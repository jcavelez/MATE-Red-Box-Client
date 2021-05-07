'use strict'


const { app, BrowserWindow } = require('electron')
const path = require('path')
const devtools = require('./devtools')
console.log(process.env.NODE_ENV)
if (process.env.NODE_ENV === 'development') {
    devtools.run_dev_tools()
}

function createWindow () {
  const win = new BrowserWindow({
    width: 700,
    height: 750,
    webPreferences: {
  //    preload: path.join(__dirname, 'preload.js')
    },
    maximizable: false,
    show: true,
    icon: path.join(__dirname, 'assets', 'icons', 'logo_small.png')
  })

  win.loadFile('./renderer/index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
'use strict'

const { settings } = require('cluster')
const { 
  app, 
  BrowserWindow, 
  ipcMain 
} = require('electron')
const path = require('path')
const devtools = require('./devtools')

if (process.env.NODE_ENV === 'development') {
    devtools.run_dev_tools()
}

console.log(path.join(__dirname, 'preload.js'))

function createWindow () {
  const win = new BrowserWindow({
    width: 700,
    height: 750,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
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

//prueba de comunicacion entre procesos
ipcMain.on('toMain', (event, args) => {
  console.log(`recibido en main ${args}`)
})

ipcMain.on('openDir', (event) => {
  const { dialog } = require('electron');
  let dialogOptions = {
    title: "Seleccione una ubicación:",
    buttonLabel: 'Seleccionar esta carpeta',
    properties: ['openDirectory','promptToCreate'],
  }
  dialog.showOpenDialog(
      dialogOptions
  ).then((res)=>{
    if(res.canceled === false) {
      console.log(res)
      event.sender.send('recievePath', res.filePaths[0])

    }
  }).catch(err => console.log('Handle Error',err))
})

ipcMain.on('startDownload', (event, downloadOptions) => {
  const startDownload = require('./recorderEvents.js')
  startDownload(downloadOptions)
})

ipcMain.on('openExportOptions', (event) => {
  console.log('recibido en main')
  const exportOptionsWindow = new BrowserWindow({
    width: 530,
    height: 540,
    title: 'Preferencias',
    //center: true,
    modal: true,
    frame: true,
    show: true
  })
  console.log(`${path.join(__dirname, './renderer/export-settings.html')}`)
  exportOptionsWindow.loadURL(`${path.join(__dirname, './renderer/export-settings.html')}`)

  exportOptionsWindow.once('ready-to-show', () => {
    exportOptionsWindow.show()
    exportOptionsWindow.focus()
  })
})




//********** */



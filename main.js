'use strict'

const { 
  app, 
  BrowserWindow, 
  ipcMain 
} = require('electron')
const settings = require('electron-settings')
const path = require('path')
const devtools = require('./devtools')

let win = null
const gotTheLock = app.requestSingleInstanceLock()

if (process.env.NODE_ENV === 'development') {
    devtools.run_dev_tools()
}

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  // Create myWindow, load the rest of the app, etc...
  app.whenReady().then(() => {
    createWindow()
  })
}

function createWindow () {
  win = new BrowserWindow({
    width: 700,
    height: 750,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js')
    },
    maximizable: false,
    show: true,
    icon: path.join(__dirname, 'assets', 'icons', 'logo_small.png')
  })

  win.loadFile('./renderer/index.html')

}

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
      settings.setSync('downloadDirectory', res.filePaths[0])
      event.sender.send('recievePath', res.filePaths[0])

    }
  }).catch(err => console.log('Handle Error',err))
})

ipcMain.on('loadPreferences', (event) => {
  console.log('DOM content loaded')
    
    const checkNewSettings = (key, value) => {
        if (!settings.hasSync(key)) {
            settings.setSync(key,value)
        }
    }

    checkNewSettings('username', 'admin')
    checkNewSettings('password', 'recorder')
    checkNewSettings('lastRecorderIP', '192.168.221.128')
    checkNewSettings('resultsToSkip', 0)
    checkNewSettings('searchMode', 'LatestFirst')
    checkNewSettings('startTime', '20210521080000')
    checkNewSettings('endTime', '20301231235959')
    checkNewSettings('outputFormat', 'mp3')
    checkNewSettings('downloadDirectory', '')

    event.sender.send('getPreferences', settings.getSync())
})

ipcMain.on('startDownload', (event, downloadOptions) => {
  const startDownload = require('./recorderEvents.js')

  for (const property in downloadOptions) {
    settings.setSync(property, downloadOptions[property])
  }

  startDownload(settings.getSync())
})

ipcMain.on('openExportOptions', (event) => {
  console.log('recibido en main')
  const exportOptionsWindow = new BrowserWindow({
    width: 530,
    height: 500,
    title: 'Preferencias',
    //center: true,
    parent: win,
    modal: true,
    frame: false,
    show: true,

  })
  console.log(`${path.join(__dirname, './renderer/export-settings.html')}`)
  exportOptionsWindow.loadURL(`${path.join(__dirname, './renderer/export-settings.html')}`)

  exportOptionsWindow.once('ready-to-show', () => {
    exportOptionsWindow.show()
    exportOptionsWindow.focus()
  })
})
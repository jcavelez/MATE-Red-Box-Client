'use strict'

const { app, BrowserWindow, ipcMain } = require('electron')
const settings = require('electron-settings')
const path = require('path')
const { createDatabase, createSchema, getRecordsNoProcesed, 
        getRecordsNoChecked, getRecordsReadyToDownload, updateRecords 
      } = require('./databaseEvents')
const devtools = require('./devtools')
const log = require('electron-log')
const { beginDownloadCycle, stopDownload} = require('./download-cycle')

console.log = log.log
settings.configure({prettify: true})
log.transports.file.level = 'info'
log.transports.file.maxSize = 5242880
//TODO: log level in setting file.
let win = null
const databaseName = 'MATE.db'


//asegurar que la aplicacion corra en una unica instancia
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  
  app.whenReady().then(() => {
    log.info('Main: App Ready')
    log.info('Main: Solicitud crear BD')
    createDatabase(databaseName) 
    log.info('Main: Solicitud crear schema')   
    createSchema()
    log.info('Main: Solicitud crear ventana')
    createLoginWindow()
  })
}

if (process.env.NODE_ENV === 'development') {
  devtools.run_dev_tools()
  log.transports.file.level = 'silly'
}

//***********Funciones**************************/
function createLoginWindow () {
  const loginWindow = new BrowserWindow({
    width: 420,
    height: 455,
    title: 'Login',
    center: true,
    parent: win,
    modal: false,
    frame: true,
    autoHideMenuBar: true,
    show: true,
  })
  loginWindow.loadURL(path.join(__dirname, './renderer/login.html'))
}


function createWindow () {
  win = new BrowserWindow({
    width: 485,
    height: 750,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js')
    },
    maximizable: false,
    show: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icons', 'logo_small.png')
  })

  win.loadFile(path.join(__dirname, 'renderer/index.html'))

  log.info(`Main: Preload file ${path.join(__dirname, 'preload.js')}`)
  log.info('Main: Ventana principal creada')
  log.info('Main: Archivo contenido ventana principal cargado ' + path.join(__dirname, 'renderer/index.html'))
}

//*******************EVENTOS ********************** */

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    log.info('Main: Cerrando ventana')
    app.quit()
  }
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
      log.info('Main: Obteniendo nuevo directorio de descarga')
    }
  }).catch(err => log.error('Main: Handle Error ',err))
})


ipcMain.on('loadPreferences', (event) => {
  log.info('Main: DOM content loaded')
    
  const checkNewSettings = (key, value) => {
    if (!settings.hasSync(key)) {
        settings.setSync(key,value)
        log.info(key + ': ' + value)
      }
  }

  log.info('Main: Cargando opciones de configuracion de usuario. Archivo: ' + settings.file())
  //Testing enviroment
  // checkNewSettings('username', 'admin')
  // checkNewSettings('password', 'recorder')
  // checkNewSettings('lastRecorderIP', '192.168.221.128')

  //EMTELCO settings
  checkNewSettings('username', 'descargas')
  checkNewSettings('password', 'descargas')
  checkNewSettings('lastRecorderIP', '10.3.6.132')

  checkNewSettings('client', '')
  checkNewSettings('resultsToSkip', 0)
  checkNewSettings('searchMode', 'EarliestFirst')
  checkNewSettings('startTime', '20210501000000')
  checkNewSettings('endTime', '20210531235959')
  checkNewSettings('outputFormat', 'mp3')
  checkNewSettings('summary', 'yes')
  checkNewSettings('overwrite', 'yes')
  checkNewSettings('downloadDirectory', 'C:\\')
  checkNewSettings('logLevel', 'INFO')
  
  event.sender.send('getPreferences', settings.getSync())
})

ipcMain.on('openExportOptions', (event) => {
  const exportOptionsWindow = new BrowserWindow({
    width: 530,
    height: 470,
    title: 'Preferencias',
    center: true,
    parent: win,
    modal: true,
    frame: false,
    show: true,
  })
  exportOptionsWindow.loadURL(`${path.join(__dirname, './renderer/export-settings.html')}`)

  log.info('Main: Ventana Opciones de Exportacion creada')
  
  exportOptionsWindow.once('ready-to-show', () => {
    exportOptionsWindow.show()
    exportOptionsWindow.focus()
  })
})


ipcMain.on('startDownload', async (event, options) => {
  log.info('Main: Senal de inicio de busqueda recibida')
  
  //Se guarda la info recibida de la web en los settings de electron para cargarlos la 
  //proxima vez que se abra la aplicación.
  log.info('Main: Guardando parametros de busqueda')
  for (const property in options) {
    settings.setSync(property, options[property])
    log.info(`Main: Guardando en settings {'${property}: ${options[property]}}`)
  }

  options = settings.getSync()

  await beginDownloadCycle(event, options)  

})


ipcMain.on('stop', (event, token) => {
  const IP = settings.getSync('lastRecorderIP')
  stopDownload(event, IP, token)
})
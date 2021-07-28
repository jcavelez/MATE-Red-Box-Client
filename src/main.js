'use strict'

const { app, BrowserWindow, ipcMain } = require('electron')
const { Worker } = require('worker_threads')
const settings = require('electron-settings')
const path = require('path')
const { createDatabase, createSchema, saveIDs } = require('./databaseEvents')
const devtools = require('./devtools')
const log = require('electron-log')
const { runLoginEvent, beginDownloadCycle, stopDownload, logout} = require('./download-cycle')
const sleep = require('./sleep')

console.log = log.log
settings.configure({prettify: true})
log.transports.file.level = 'info'
log.transports.file.maxSize = 5242880
//TODO: log level in setting file.
let loginWindow = null
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
    log.info('Main: Cargando ventana de Login')
    createLoginWindow()
  })
}

if (process.env.NODE_ENV === 'development') {
  devtools.run_dev_tools()
  log.transports.file.level = 'info'
}

//***********Funciones**************************/
function createLoginWindow () {
  loginWindow = new BrowserWindow({
    width: 420,
    height: 550,
    title: 'MATE - Red Box Client | Login',
    center: true,
    parent: win,
    modal: false,
    frame: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })
  loginWindow.loadURL(path.join(__dirname, './renderer/login.html'))

  loginWindow.once('ready-to-show', () => {
    const lastLogin = {
      recorder: settings.hasSync('lastRecorderIP') ? settings.getSync('lastRecorderIP') : '',
      username: settings.hasSync('username') ? settings.getSync('username') : '',
      password: settings.hasSync('password') ? settings.getSync('password') : ''
    }
    loginWindow.webContents.send('loadLastLogin', lastLogin)
    loginWindow.show()
    
  })
}


function createWindow () {
  win = new BrowserWindow({
    width: 485,
    height: 670,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js')
    },
    maximizable: false,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icons', 'logo_small.png')
  })

  win.loadFile(path.join(__dirname, 'renderer/index.html'))

  log.info(`Main: Preload file ${path.join(__dirname, 'preload.js')}`)
  log.info('Main: Ventana principal creada')
  log.info('Main: Archivo contenido ventana principal cargado ' + path.join(__dirname, 'renderer/index.html'))
}


function saveLoginData(loginData){
  settings.setSync('lastRecorderIP', loginData.recorder)
  settings.setSync('username', loginData.username)
  settings.setSync('password', loginData.password)
}




//************************************************* */
//*******************EVENTOS ********************** */
//************************************************* */

app.on('window-all-closed', async () => {
  log.info('Main: Event window-all-closed')
  log.info('Main: Logging out')
  await logout(settings.getSync('lastRecorderIP'))
  if (process.platform !== 'darwin') {
    log.info('Main: Closing App')
    app.quit()
  }
})

// ............. Login Event ....................................
ipcMain.on('login', async (event, loginData) => {
  if(loginData.saveData) {
    saveLoginData(loginData)
  }
  await runLoginEvent(event, loginData)
})

//...............Open Main Window Event .........................
ipcMain.on('openMainWindow', () => {
  log.info('Main: Cerrando ventana de Login')
  loginWindow.hide()
  log.info('Main: Cargando ventana principal')
  createWindow()
  win.show()
  loginWindow.close()
})

//..............Open Directory Event ...........................
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

// ...............Load Preferences Event .................
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
  // checkNewSettings('username', 'descargas')
  // checkNewSettings('password', 'descargas')
  // checkNewSettings('lastRecorderIP', '10.3.6.132')

  checkNewSettings('client', 'EMTELCO')
  checkNewSettings('searchMode', 'EarliestFirst')
  checkNewSettings('startTime', '20210531000000')
  checkNewSettings('endTime', '20210531235959')
  checkNewSettings('outputFormat', 'mp3')
  checkNewSettings('report', 'yes')
  checkNewSettings('overwrite', 'yes')
  checkNewSettings('parallelDownloads', 1)
  checkNewSettings('downloadDirectory', 'C:\\')
  checkNewSettings('logLevel', 'INFO')
  
  event.sender.send('getPreferences', settings.getSync())
})

//............. Open Export Options Window ...............
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
  
  //Se guarda la info recibida de la web en los settings de electron para cargarlos 
  //la proxima vez que se abra la aplicación.
  log.info('Main: Guardando parametros de busqueda')
  for (const property in options) {
    settings.setSync(property, options[property])
    log.info(`Main: Guardando en settings {'${property}: ${options[property]}}`)
  }

  if (!options.hasOwnProperty('group')) {
    settings.unsetSync('group')
  }
  
  options = settings.getSync()

  beginDownloadCycle(event, options)  

})


ipcMain.on('stop', (event) => {
  const IP = settings.getSync('lastRecorderIP')
  stopDownload(event, IP)
})

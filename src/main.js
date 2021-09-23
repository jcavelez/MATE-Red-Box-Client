'use strict'

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron')
const { Worker } = require('worker_threads')
const settings = require('electron-settings')
const path = require('path')
const { createDatabase, createSchema, saveSessionSettings, getLastLogin, getLastSearch, saveSearch, getSessionSettings } = require('./databaseEvents')
const devtools = require('./devtools')
const log = require('electron-log')
const { runLoginEvent, beginDownloadCycle, forceStopProcess, logout } = require('./download-cycle')
const sleep = require('./sleep')
const { setupErrors } = require('./handler-errors')

console.log = log.log
settings.configure({prettify: true})
log.transports.file.level = 'info'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'
//TODO: log level in setting file.
let loginWindow = null
let win = null
let appTray = null
const icon = path.join(__dirname, 'assets', 'img', 'icon_black.ico')
let appIcon = nativeImage.createFromPath(icon)
const databaseName = 'MATE.db'

let modalOpened = false


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
    createDefaultSettings()
    
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
    icon: appIcon.resize({ width: 16 }),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  setupErrors(loginWindow)

  loginWindow.loadURL(path.join(__dirname, './renderer/login.html'))

  loginWindow.once('ready-to-show', async () => {
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
    icon: appIcon.resize({ width: 16 }),
    darkTheme: true
  })

  setupErrors(win)

  win.loadFile(path.join(__dirname, 'renderer/index.html'))
  
  log.info(`Main: Preload file ${path.join(__dirname, 'preload.js')}`)
  log.info('Main: Ventana principal creada')
  log.info('Main: Archivo contenido ventana principal cargado ' + path.join(__dirname, 'renderer', 'index.html'))

  let contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => win.show() },
    { label: 'Quit', click: () => warningClose() }
  ])

  log.info(`Main: Creando icono tray.`)
  appTray = new Tray(appIcon.resize({ width: 32 }))
  appTray.setToolTip('MATE - Red Box Client')
  appTray.setContextMenu(contextMenu)

  appTray.on('double-click', () => win.show())

  win.on('close', (event) => {
    event.preventDefault()
    //log.info(modalOpened) //<-------------------delete
    if (modalOpened) {
      win.hide()
    } else {
      win.destroy()
    }
  })
}


async function warningClose(){
  log.info(`Main: Cerrando aplicacion`)
  const options = {
    message: '¿Desea cerrar completamente la aplicación e interrumpir las descargas activas?',
    type: 'question',
    buttons: ['Si', 'No'],
    title: 'Cerrando...'
  }

  const resp = dialog.showMessageBoxSync(win, options)

  if(resp === 0) {
    win.hide()
    try {
      forceStopProcess()
    } catch (error) {
      log.error(error)
    }

    await sleep(4000) //esperar que los posibles procesos de descarga se cierren correctamente
    
    win.destroy()
  }
}

function createDefaultSettings() {
  const checkNewSettings = (key, value) => {
    if (!settings.hasSync(key)) {
        settings.setSync(key,value)
        log.info(key + ': ' + value)
      }
  }

    log.info('Main: Creando configuracion por defecto. Archivo: ' + settings.file())

    //checkNewSettings('startTime', '20210531000000')
    //checkNewSettings('endTime', '20210531235959')
    //checkNewSettings('downloadDirectory', 'C:\\')
    checkNewSettings('client', '')
    checkNewSettings('searchMode', 'EarliestFirst')
    checkNewSettings('outputFormat', 'mp3')
    checkNewSettings('report', 'yes')
    checkNewSettings('overwrite', 'yes')
    checkNewSettings('parallelDownloads', 1)
    checkNewSettings('logLevel', 'INFO')
    checkNewSettings('callIDField', 'yes')
    checkNewSettings('externalCallIDField', 'no')
    checkNewSettings('startDateField', 'no')
    checkNewSettings('extensionField', 'no')
    checkNewSettings('channelNameField', 'no')
    checkNewSettings('otherPartyField', 'no')
    checkNewSettings('agentGroupField', 'no')
}



//************************************************* */
//*******************EVENTOS ********************** */
//************************************************* */


app.on('window-all-closed', async (event) => {
  log.info('Main: Event window-all-closed emitted')
  log.info('Main: Logging out')
  await logout(settings.getSync('lastRecorderIP'))
  if (process.platform !== 'darwin') {
    log.info('Main: Closing App')
    app.quit()
  }
})

app.on('will-quit', async () => {
  log.info('Main: Event will-quit emitted')
})

// ............. Login Event ....................................
ipcMain.on('login', async (event, loginData) => {
  settings.setSync('lastRecorderIP', loginData.recorder)
  settings.setSync('username', loginData.username)

  loginData.saveData ? settings.setSync('rememberLastSession', 'yes') : settings.setSync('rememberLastSession', 'no')
  
  saveSessionSettings(loginData.username, {
    lastRecorderIP: loginData.recorder,
    lastPassword: loginData.password
  })

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

// ...............Load last Search Event .......................

ipcMain.handle('loadLastSearch', (event) => {
  log.info('Main: loadLastSearch event recieved')
  
  let lastSearch = { ...getLastSearch(settings.getSync('username')) }
  
  console.log(lastSearch)
  
 return lastSearch
})

// ...............Load Last Login Event ........................

ipcMain.handle('loadLastLogin', (event) => {
  let lastLogin = {}
  const remember = settings.hasSync('rememberLastSession') ? settings.getSync('rememberLastSession') : 'no'

  if (remember == 'yes' && settings.hasSync('username')) {
    lastLogin = {  ...getLastLogin(settings.getSync('username'))}
  }

  log.info(`Main: Enviando webContent 'loadLastLogin'`)

  //console.log(lastLogin)
  return lastLogin
})

//............. Open Export Options Window .....................
ipcMain.on('openExportOptions', (event) => {
  const exportOptionsWindow = new BrowserWindow({
    width: 435,
    height: 500,
    resizable: false,
    title: 'Preferencias',
    //center: true,
    frame: false,
    parent: win,
    hasShadow: true,
    darkTheme: true,
    modal: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  exportOptionsWindow.loadURL(`${path.join(__dirname, './renderer/export-settings.html')}`)

  log.info('Main: Ventana Opciones de Exportacion creada')
  
  exportOptionsWindow.once('ready-to-show', () => {
    exportOptionsWindow.show()
    exportOptionsWindow.focus()
  })
})

//............. Load Export Options Event .....................
ipcMain.handle('loadExportPreferences', () => {
  let exportPreferences = getSessionSettings(settings.getSync('username'))

  return exportPreferences
})

//............. Start Download Event ........................


ipcMain.on('startDownload', async (event, options) => {
  log.info('Main: Senal de inicio de busqueda recibida')
  
  //Se guarda la info recibida de la web en los settings de electron para cargarlos 
  //la proxima vez que se abra la aplicación.
  log.info('Main: Guardando parametros de busqueda')
  for (const property in options) {
    settings.setSync(property, options[property])
    log.info(`Main: Guardando en settings {'${property}: ${options[property]}}`)
  }

  if (!options.hasOwnProperty('extension')) {
    settings.unsetSync('extension')
  }

  if (!options.hasOwnProperty('group')) {
    settings.unsetSync('group')
  }

  const lastLogin = getLastLogin(settings.getSync('username'))
  //console.log(lastLogin)

  const searchData = {
    lastRecorderIP: lastLogin.lastRecorderIP,
    client: settings.hasSync('client') ? settings.getSync('client') : null,
    username: lastLogin.username,
    startTime: options.startTime,
    endTime: options.endTime,
    Extension: options.hasOwnProperty('extension') ? options.extension.join(',') : null,
    AgentGroup: options.hasOwnProperty('group') ? options.group : null,
    //searchMode: options.searchMode,
    //resultsToSkip: 0,
    downloadDirectory: options.downloadPath
  }

  //console.log(searchData)
  saveSearch(searchData)

  options = settings.getSync()

  const sessionSettings = {
                          outputFormat: options.outputFormat,
                          report: options.report,
                          overwrite: options.overwrite,
                          parallelDownloads: options.parallelDownload,
                          rememberLastSession: options.rememberLastSession ,
                          callIDField: options.callIDField,
                          externalCallIDField: options.externalCallIDField,
                          startDateField: options.startDateField,
                          endDateField: options.endDateField,
                          extensionField: options.extensionField,
                          channelNameField: options.channelNameField,
                          otherPartyField: options.otherPartyField,
                          agentGroupField: options.agentGroupField
                          }

  saveSessionSettings(options.username, sessionSettings)
  
  const savedSession = getLastLogin(options.username)
  
  for (const key in savedSession) {
    options[key] = savedSession[key] === null ?  settings.getSync(key) : savedSession[key]
  }

  
  //console.log(options)
  beginDownloadCycle(event, options)  

})

//............. Stop Download Event ........................

ipcMain.on('stop', () => {
  log.info(`Main: Message stop received`)
  forceStopProcess()
})


ipcMain.on('updatePreferences', (event, prefs) => {
  log.info(`Main: Message updatePreferences received`)
  for (const key in prefs) {
    log.info(`Main: Guardando ${key} = ${prefs[key]}`)
    settings.setSync(key, prefs[key])
  }
  log.info(`Main: Preferencias actualizadas correctamente.`) 
})


ipcMain.on('modalStatus', (event, data) => {
  //log.info(`Main: Message modalStatus received - ${data}`)
  modalOpened = data
})
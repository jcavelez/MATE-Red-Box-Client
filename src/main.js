'use strict'

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, session } = require('electron')
const { Worker } = require('worker_threads')
const settings = require('electron-settings')
const path = require('path')
const { createDatabase, createSchema, saveSessionSettings, getLastLogin, getLastRecordingDownloaded, getLastSearch, saveSearch, getSessionSettings, clearRecordsTable } = require('./databaseEvents')
const devtools = require('./devtools')
const log = require('electron-log')
const { runLoginEvent, beginDownloadCycle, forceStopProcess, logout } = require('./download-cycle')
const sleep = require('./sleep')
const { setupErrors } = require('./handler-errors')

console.log = log.log
settings.configure({prettify: true})
log.transports.file.level =  settings.hasSync('logLevel') ? settings.getSync('logLevel') : 'error'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'
let loginWindow = null
let win = null
let appTray = null
const icon = path.join(__dirname, 'assets', 'img', 'icon_black.ico')
let appIcon = nativeImage.createFromPath(icon)
const databaseName = 'MATE.db'
let PERSISTENT_MODE = false
let RETRY_TIME = 10000 // ms

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
  //log.transports.file.level = 'info'
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

  //setupErrors(loginWindow)

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

//COMIENZO EN LOGIN PROCESO PARA GUARDAR DATA EN BD
//ESTA FUNCION PUEDE QUEDAR OBSOLETA. REVISAR SI SE PUEDE BORRAR
function createDefaultSettings() {
  const checkNewSettings = (key, value) => {
    if (!settings.hasSync(key)) {
        settings.setSync(key,value)
        log.info(key + ': ' + value)
      }
  }

    log.info('Main: Creando configuracion por defecto. Archivo: ' + settings.file())

    checkNewSettings('client', '')
    checkNewSettings('searchMode', 'EarliestFirst')
    checkNewSettings('persistentMode', false)
    checkNewSettings('outputFormat', 'mp3')
    checkNewSettings('report', 'yes')
    checkNewSettings('overwrite', 'yes')
    checkNewSettings('parallelDownloads', 1)
    checkNewSettings('logLevel', 'error')
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

  const isFirstLogin = () => {
    return (getLastLogin(loginData.username, loginData.recorder) == null)
  }

  let sessionInfo = {
    lastPassword: loginData.password,
    rememberLastSession: loginData.saveData ? 'yes' : 'no'
  }

  //Si es el primer login, se crean las opciones por defecto
  if (isFirstLogin()) {
    sessionInfo.outPutFormat = 'mp3'
    sessionInfo.report = 'yes'
    sessionInfo.overwrite = 'yes'
    sessionInfo.parallelDownloads = 1
    sessionInfo.callIDField = 'yes'
    sessionInfo.externalCallIDField = 'no'
    sessionInfo.startDateField = 'no'
    sessionInfo.endDateField = 'no'
    sessionInfo.extensionField = 'no'
    sessionInfo.channelNameField = 'no'
    sessionInfo.otherPartyField = 'no'
    sessionInfo.agentGroupField = 'no'
    sessionInfo.client = ''
  }

  saveSessionSettings(loginData.username, loginData.recorder, sessionInfo)

  //se guarda la sesion actual en archivo de settings
  settings.setSync('username', loginData.username)
  settings.setSync('lastRecorderIP', loginData.recorder)

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
      //console.log(res)
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
  
  //console.log(lastSearch)
  
 return lastSearch
})


// ...............Load Last Login Event ........................

ipcMain.handle('loadLastLogin', (event) => {
  if (settings.hasSync('username') && settings.hasSync('lastRecorderIP')) {
    return getLastLogin(settings.getSync('username'), settings.getSync('lastRecorderIP'))
  } 
  else return {}
})


//............. Open Export Options Window .....................

ipcMain.on('openUserOptions', (event) => {
  const userOptionsWindow = new BrowserWindow({
    width: 430,
    height: 300,
    resizable: false,
    title: 'Opciones de Usuario',
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

  userOptionsWindow.loadURL(`${path.join(__dirname, './renderer/user-settings.html')}`)

  log.info('Main: Ventana Opciones de Usuario creada')

  userOptionsWindow.once('ready-to-show', () => {
    userOptionsWindow.show()
    userOptionsWindow.focus()
  })

  userOptionsWindow.on('closed', () => {
    event.sender.send('userOptionsWindowClosed')
  })

})


//............. Open Export Options Window .....................

ipcMain.on('openExportOptions', (event) => {
  const exportOptionsWindow = new BrowserWindow({
    width: 430,
    height: 535,
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

  exportOptionsWindow.on('closed', () => {
    event.sender.send('exportsWindowClosed')
  })
})

//............. Load Export Options Event .....................
ipcMain.handle('loadExportPreferences', () => {
  let exportPreferences = getSessionSettings(settings.getSync('username'))
  //console.log(exportPreferences)

  return exportPreferences
})

//............. Start Download Event ........................


ipcMain.on('startDownload', async (event, options) => {
  log.info('Main: Senal de inicio de busqueda recibida')
  PERSISTENT_MODE = options.persistentMode
  
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

  const lastLogin = getLastLogin(settings.getSync('username'), settings.getSync('lastRecorderIP'))

  //Se reune unicamente la informacion necesaria para guardar en BD en la siguiente variable
  //TODO: Guardar persistent mode en BD
  const searchData = {
    lastRecorderIP: lastLogin.lastRecorderIP,
    client: settings.hasSync('client') ? settings.getSync('client') : null,
    username: lastLogin.username,
    startTime: options.startTime,
    endTime: options.endTime,
    Extension: options.hasOwnProperty('extension') ? options.extension.join(',') : null,
    AgentGroup: options.hasOwnProperty('group') ? options.group : null,
    downloadDirectory: options.downloadPath
  }

  // se guarda en BD
  saveSearch(searchData)

  options = settings.getSync()

  //se recolecta todo lo que llega desde el frontend para guardarlo en BD
  const sessionSettings = {
                          outputFormat: options.outputFormat,
                          report: options.report,
                          overwrite: options.overwrite,
                          parallelDownloads: options.parallelDownloads,
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

  //se guarda info en BD
  saveSessionSettings(options.username, options.lastRecorderIP, sessionSettings)
  
  const savedSession = getLastLogin(options.username,  options.lastRecorderIP)

  options = Object.assign(options, savedSession)

  clearRecordsTable()

  await beginDownloadCycle(event, options)
  // await sleep(RETRY_TIME)
  // console.log('terminando ciclo-----')
  // options.endTime = getLastRecordingDownloaded()
  // console.log(options.endTime)

})


//............. Stop Download Event ........................

ipcMain.on('stop', () => {
  log.info(`Main: Message stop received`)
  forceStopProcess()
})


//................. Update Export Preferences Event .......................

ipcMain.on('updatePreferences', (event, prefs) => {
  log.info(`Main: Message updatePreferences received`)
  for (const key in prefs) {
    log.info(`Main: Guardando ${key} = ${prefs[key]}`)
    settings.setSync(key, prefs[key])
  }

  saveSessionSettings(settings.getSync('username'), settings.getSync('lastRecorderIP'), prefs)
  log.info(`Main: Preferencias actualizadas correctamente.`) 
})


ipcMain.on('modalStatus', (event, data) => {
  //log.info(`Main: Message modalStatus received - ${data}`)
  modalOpened = data
})


// ........................ Log Level Events ...................

ipcMain.handle('loadLogLevel', () => {
  return log.transports.file.level
})

ipcMain.on('setDebuggingLevel', (event, data) => {
  log.transports.file.level = data.level.toLowerCase()
  settings.set('logLevel', data.level.toLowerCase())
  log.warn(`Main: Nuevo nivel de debugging "${data.level}""`)
})
'use strict'

const { app, BrowserWindow, ipcMain } = require('electron')
const settings = require('electron-settings')
const path = require('path')
const { createDatabase, createSchema, getRecordsNoProcesed, 
        getRecordsNoChecked, getRecordsReadyToDownload, updateRecords 
      } = require('./databaseEvents')
const { ExternalCallIDCheck } = require('./assets/lib/EMTELCO.js')
const devtools = require('./devtools')
const log = require('electron-log');
const sleep = require('./sleep.js')
const { Worker } = require('worker_threads')
//const Recorder = require('./assets/lib/Recorder')

console.log = log.log
settings.configure({prettify: true})
log.transports.file.level = 'info'
log.transports.file.maxSize = 5242880
//TODO: log level in setting file.
let win = null
let workers = []
const databaseName = 'MATE.db'
const MAX_DOWNLOAD_WORKERS = 2
let downloadRunning = false
let login = {}

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
    createWindow()
  })
}

if (process.env.NODE_ENV === 'development') {
  devtools.run_dev_tools()
  log.transports.file.level = 'silly'
}

//***********Funciones**************************/
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
    icon: path.join(__dirname, 'assets', 'icons', 'logo_small.png')
  })

  win.loadFile(path.join(__dirname, 'renderer/index.html'))

  log.info(`Main: Preload file ${path.join(__dirname, 'preload.js')}`)
  log.info('Main: Ventana principal creada')
  log.info('Main: Archivo contenido ventana principal cargado ' + path.join(__dirname, 'renderer/index.html'))
}

const stopDownload = (event, token) => {
  log.info(`Main: Senal stop recibida. Eliminando procesos`)
  workers.forEach(worker => {
  worker.terminate()
  worker.unref()
  })

  workers = []
  downloadRunning = false
  const { logoutRecorder } = require('./recorderEvents.js')
  logoutRecorder(settings.getSync('lastRecorderIP'), token)
  event.sender.send('queryFinished')
}

const counter = () => {
  let privateCounter = 0

  const changeBy = (val) => {
    privateCounter  += val
  }
  return {
    increment: () => { changeBy(1) },
    decrement: () => { changeBy(-1) },
    value: () =>  privateCounter 
  }
}

//*******************EVENTOS ********************** */

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    log.info('Main: Cerrando ventana')
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

    checkNewSettings('client', 'EMTELCO')
    checkNewSettings('resultsToSkip', 0)
    checkNewSettings('searchMode', 'LatestFirst')
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
  downloadRunning = true
  
  //primero guardo todo en los settings de electron para cargarlos la 
  //proxima vez que se abra la aplicación.
  log.info('Main: Guardando parametros de busqueda')
  for (const property in options) {
    settings.setSync(property, options[property])
    log.info(`Main: Guardando en settings {'${property}: ${options[property]}}`)
  }

  options = settings.getSync()

  const { loginRecorder } = require('./recorderEvents.js')
  const { search } = require('./recorderEvents.js')
  const { logoutRecorder } = require('./recorderEvents.js')

  const recorderIP = options.lastRecorderIP
  const username = options.username
  const password = options.password

  const getToken = async () => {
    log.info('Main: Solicitud login ' + recorderIP)
    login = await loginRecorder(recorderIP, username, password)
  }

  const checkToken = async () => {
    if (login.hasOwnProperty('authToken')) {
      log.info('Main: Validando login OK')
      await sleep(1000)
      event.sender.send('newToken', login.authToken)
      event.sender.send('recorderSearching')
      return true
    } else if (login.hasOwnProperty('error')) {
      log.error('Main: Validando login Error ' + login.error)
      await sleep(1000)
      event.sender.send('recorderLoginError', login.error)
      return false
    }
    else {
      log.error('Main: Validando login Error: ' + login.type + ' ' + login.errno)
      event.sender.send('recorderLoginError', login.type + ' ' + login.errno )
      return false
    }
  }

  
  const beginSearch = async () => {
    log.info('Main: solicitud busqueda')
    let nResults =  await search(options, login.authToken)
    log.info('Main: resultados recibidos')
  }

  const getDetails = async () => {
    try {
      const workerURL = `${path.join(__dirname, 'details-worker.js')}`
      const data = {
                    workerData: {
                                  IP: options.lastRecorderIP,
                                  token: login.authToken
                                }
                    }
      const worker = new Worker(workerURL, data) 
  
      worker.on('message', (msg) => {
        if (msg.type === 'next') {
          try {
            const id = getRecordsNoProcesed(1)[0].callID
            log.info(`Main: Details Next ID ${id}`)
            worker.postMessage(id)
          } catch (e) {
            log.error(`Main: Termina proceso de descarga de detalles de llamada`)
            worker.terminate()
          }
        } else if (msg.type === 'details') {
          log.info(`Main: CallID ${msg.callID}. Detalles de llamada recibidos`)
          updateRecords(msg.callData, msg.callID)
        }
      })
  
      workers.push(worker)
      await sleep(5000)
    } catch (e) {
      log.error(`Main: Error creando Details Worker. ${e}`)
    }
  }

  const specialClientChecks = async () => {
    
    try {
      
      if (options.client === 'EMTELCO') {
        log.info(`Client Checks: EMTELCO`)

        //downloadRunning modificado a false en stop search
        while (downloadRunning) {
          let call = getRecordsNoChecked(1)[0]
          if (call === undefined) {
            log.info(`EMTELCO Check: No se encontro nuevo registro.`)
            await sleep(5000)
            continue
          }
          log.info(`EMTELCO Check: Buscando ExternalCallID para ${call.callID}`)
          const newExternalCallID = ExternalCallIDCheck(call)
          log.info(`EMTELCO Check: CallID ${call.callID} asociado a ${newExternalCallID}`)
          updateRecords({ExternalCallID: newExternalCallID}, call.callID)
        }
      }
    } catch (e) {
      log.error(`EMTELCO Check: Error ${e}`)
    }

  }

  const download = async () => {
    event.sender.send('recorderDownloading')
    let queryFails = counter()
    
    for (let i = 0; i < MAX_DOWNLOAD_WORKERS; i++) {
      
      try {
        
        log.info('Main: Creando nuevo worker.')
        const workerURL = `${path.join(__dirname, 'download-worker.js')}`
        const data = {
                      workerData: { options }
                     }
        const worker = new Worker(workerURL, data) 
  
        worker.on('message', (msg) => {
          if (msg.type === 'next') {
            try {
              const { ...callData } = getRecordsReadyToDownload(1)[0]
              log.info(`Main: Download Next ID ${callData.callID}`)
              updateRecords({idEstado: 2}, callData.callID)
              worker.postMessage({type: 'call', callData: callData})
            } catch (e) {
              log.error(`Main: No se encontraron nuevas grabaciones en estado Listo Para Descargar.`)
              queryFails.increment()
              queryFails.value() >= 5 ? stopDownload(event, login.authToken) : worker.postMessage({type: 'wait'})
            }
          } else if (msg.type === 'update') {
            log.info(`Main: CallID ${msg.callID} cambiando estado BD.`)
            updateRecords(msg.callData, msg.callID)
          }
        })
  
        workers.push(worker)
      } catch (e) {
        log.error(`Main: Error creando Download Worker. ${e}`)
      }

      await sleep(100)
    }
  }

  const beginDownloadCicle = async () => {
    await getToken()
    if (await checkToken()) {
      await beginSearch()
      getDetails()
      specialClientChecks()
      download()
      //manejar logout
    }
  }

  await beginDownloadCicle()  

})

ipcMain.on('stop', stopDownload)


const { webContents, ipcMain } = require('electron')
const log = require('electron-log')
const path = require('path')
const sleep = require('./sleep.js')
const counter = require('./assets/lib/counter.js')
const { ExternalCallIDCheck } = require('./assets/lib/EMTELCO.js')
const { getNewStartTime, getNewEndTime } = require('./assets/lib/newDatesPersistentMode.js')
const { logoutRecorder } = require('./recorderEvents.js')
const { clearRecordsTable } = require('./databaseEvents')
const { getRecordsNoProcesed,
        getRecordsNoChecked,
        getRecordsReadyToDownload,
        getTotalDownloads,
        getTotalErrors,
        getTotalPartials,
        getTotalRows,
        getLastRecordingDownloaded,
        updateRecords,
        saveIDs,
        saveSearch } = require('./databaseEvents')
const { createErrorLog, saveDownloadError } = require('./download-error-logs')
const { Worker } = require('worker_threads')
const ipcTransportFactory = require('electron-log/src/transports/ipc')
log.transports.file.level ='error'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'


let downloadRunning = false
let workers = []
let loginWorker = null
let searchWorker = null
let currentToken = null
let loginError = null

let MAX_DOWNLOAD_WORKERS = 1
let PERSISTENT_MODE = false
let persistentModeRunning = false
const DELAY = 12000 // ms
let currentEvent = null

const errorLogPath = `C:\\MATE\\download-errors.txt`

async function runLoginEvent(event, loginData) {
  currentEvent = event 
  currentToken = null
  loginError = null

  if (loginWorker == null) {
    loginWorker = createLoginProcess(loginData.recorder, loginData.username, loginData.password)
  } else {
    updateCredentials(loginData.recorder, loginData.username, loginData.password)
  }

  await updateToken()

  log.info('Main: Validando login')

  if (currentToken != null) {
    log.info('Main: Login OK')
    
    //TO DO: envio mensaje a ipcrenderer porque desde este modulo no se puede importar
    event.sender.send('loginAlert', 'Login exitoso')
  } 
  else {
    event.sender.send('loginAlert', loginError)
  }
}

function createLoginProcess (recorderIP, username, password) {
  log.info('Main: Creando login worker.')

  const workerURL = `${path.join(__dirname, 'login-worker.js')}`
  const data = {
                workerData: {
                              options: {
                                recorderIP: recorderIP,
                                username: username,
                                password: password
                              }
                            }
                }
  let worker = new Worker(workerURL, data) 

  worker.on('message', (msg) => {
    log.info(`Main: Mensaje recibido de Login Worker `)
    if(msg.type === 'token') {
      currentToken = msg.data
      workers.forEach(w => {
        w.postMessage({type: 'updatedToken' , token: currentToken})
      })
    }

    if (msg.type === 'error') {
      currentToken = null
      loginError = msg.data
    }
  })

  return worker
}

async function updateToken() {
  try {
    log.info(`Main: Actualizando token`)
    await sleep(1500)
    //esperamos hasta que tengamos el token o un error
    while (currentToken == null && loginError == null) {
      loginWorker.postMessage({type: 'getToken'})
      await sleep(2000)
    }
    log.info(`Main: Token actualizado`)
    return
  } catch (e) {
    log.error(`Main: Error actualizando Token ${e}`)
  }
}

function updateCredentials(recorderIP, username, password) {
  const data = {
      recorderIP: recorderIP,
      username: username,
      password: password
  }
  loginWorker.postMessage({type: 'updateCredentials', data: data})
}

function renewToken () {
  loginWorker.postMessage({type: 'renewToken'})
}


const beginDownloadCycle = async (event, options) => {

  //clearRecordsTable() // se cambia para main

  currentEvent = event
   
  log.info(`Main: Iniciando busqueda`)

  try {
    MAX_DOWNLOAD_WORKERS = options.parallelDownloads
  } catch (e) {
    log.error(`Main: opcion 'parallelDownloads' no configurado`)
  }
  
  await createErrorLog(errorLogPath)

  searchWorker = await createSearchWorker(options)
  searchWorker.postMessage({type: 'search'})
  currentEvent.sender.send('recorderSearching')

}

const processPartialSearch = async (options) => {
  downloadRunning = true
  let tempWorkers = []
  log.info(`Main: Creando Details Workers`)
  let detailsWorkers = await createDetailsWorkers(options)
  currentEvent.sender.send('recorderDownloading')
  specialClientChecks(options.client)
  //Tiempo para que el SpecialCheck comience su revision
  await sleep(10000)
  let downloadWorkers = await createDownloadWorkers(options)

  tempWorkers = [].concat(detailsWorkers, downloadWorkers)

  while (downloadRunning) {
    const threadIds = tempWorkers.map(w => w.threadId)
    if(threadIds.findIndex(id => id != -1) === -1) {
      downloadRunning = false
      return
    } else {
      log.info(`Main: Descarga parcial activa. Esperando 2 segundos.`)
      await sleep(2000)
      const downloads = getTotalDownloads()[0].total
      const total = getTotalRows()[0].total
      currentEvent.sender.send('searchUpdate', {successes: downloads, total: total})
    }
  }

  //este codigo se ejecuta cuando la busqueda ha sido interrumpida
  //con el boton Detener
  searchWorker.postMessage({type: 'end'})
  searchWorker = null
  const successes = getTotalDownloads()[0].total
  const failures = getTotalErrors()[0].total
  const partials = getTotalPartials()[0].total
  const data = {
      successes: successes,
      failures: failures,
      partials: partials
  }
  tempWorkers.forEach((tempWorker) => tempWorker.postMessage({type: 'end'}))
  await sleep(500)
  currentEvent.sender.send('queryInterrupted', data)
}


const createSearchWorker = async (options) => {
  log.info('Main: Creando search worker.')
  PERSISTENT_MODE = options.persistentMode
  persistentModeRunning = PERSISTENT_MODE
  options.token = currentToken
  const workerURL = `${path.join(__dirname, 'search-worker.js')}`
  const data = {
                workerData: {
                              options
                            }
                }
  
  const worker = new Worker(workerURL, data) 

  worker.on('message', async (msg) => {

    if (msg.type === 'results') {
      //ordenando resultados antes de guardarlos para hacer de forma mas eficiente el check de emtelco
      console.log(msg.IDs)
      saveIDs(msg.IDs.sort((a, b) => a - b))
      log.info(`Main: ${msg.IDs.length} IDs guardados en BD`)
      await processPartialSearch(options)
      // el API devuelve en paquetes de 1000, por lo tanto si el resultado es 1000, significa que hay resultados pendientes.
      //continua la busqueda
      if (msg.IDs.length === 1000 ) {
        worker.postMessage({type: 'search'})
        currentEvent.sender.send('recorderSearching')
      } 
      //si el ultimo lote de IDs tenia menos de 1000 resultados significa que es el ultimo lote de la busqueda
      //Busqueda terminada
      else if (msg.IDs.length < 1000 && !PERSISTENT_MODE){
        await stopSearchingProcess()
      }
      
      //empieza una nueva busqueda con nuevas fechas
      else if (msg.IDs.length < 1000 && PERSISTENT_MODE) {
        let d = getNewStartTime()
        options.startTime = d === null ? options.startTime : d
        options.endTime = getNewEndTime()

        worker.postMessage({
          type: 'updateSearch',
          newStartTime: options.startTime,
          newEndTime: options.endTime
        })
      }
    }
    

    else if ((msg.type === 'complete' || msg.type === 'error') && PERSISTENT_MODE ) {
      console.log('MODO PERSISTENTE -----------------------')
      await sleep(DELAY)
      let d = getNewStartTime()
      options.startTime = d === null ? options.startTime : d
      options.endTime = getNewEndTime()
      
      worker.postMessage({
                            type: 'updateSearch',
                            newStartTime: options.startTime,
                            newEndTime: options.endTime
                          })
    }

    else if (msg.type === 'complete' && !PERSISTENT_MODE) {
      log.info('Main: Busqueda terminada. Finalizando proceso.')
      searchWorker.postMessage({type: 'end'})
      await stopSearchingProcess()
    }

    else if (msg.type === 'error' && !PERSISTENT_MODE) {
      log.info('Main: Enviando error a Renderer')
      currentEvent.sender.send('searchError', { error: msg.error })
      searchWorker.postMessage({type: 'end'})
      searchWorker = null
    }

  })

  return worker

}

const createDetailsWorkers = async (options) => {
  try {
    let detWorkers = []
    for (let i = 1; i <= 2; i++) {
      log.info('Main: Creando details worker.')
      options.token = currentToken
      const workerURL = `${path.join(__dirname, 'details-worker.js')}`
      const data = {
                    workerData: {
                                  options
                                }
                    }
      const worker = new Worker(workerURL, data) 
  
      worker.on('message', async (msg) => {
        if (msg.type === 'next') {
          try {
            const id = getRecordsNoProcesed(1)[0].callID
            log.info(`Main: Details Next ID ${id}`)
            updateRecords({idEstado: 1}, id)
            worker.postMessage({type: 'call', callID: id})
          } catch (e) {
            log.error(`Main: No se encuentra ningun registro en estado 'No procesado'`)
            worker.postMessage({type: 'end'})
          }
        } 
        
        else if (msg.type === 'details') {
          log.info(`Main: CallID ${msg.callID}. Detalles de llamada recibidos`)
          updateRecords(msg.callData, msg.callID)
        } 
        
        else if (msg.type === 'newToken') {
          log.info(`Main:. Solicitud de nuevo token recibida.`)
          renewToken()
        } else if (msg.type === 'update') {
          log.info(`Main: CallID ${msg.callID} cambiando estado BD a ${msg.callData.idEstado}.`)
          updateRecords(msg.callData, msg.callID)
        }
      })
  
      detWorkers.push(worker)
      await sleep(200)
    }


    return detWorkers

  } catch (e) {
    log.error(`Main: Error creando Details Worker. ${e}`)
  }
}

const specialClientChecks = async (client) => {
  log.info(`Main: Buscando funciones especiales para cliente ${client}`)
    
  try {
    
    if (client === 'EMTELCO') {
      log.info(`Client Checks: EMTELCO`)

      //downloadRunning modificado a false en stop search
      while (downloadRunning) {
        let call = getRecordsNoChecked(1)[0]
        if (call === undefined) {
          log.info(`EMTELCO Check: No se encontro nuevo registro.`)
          await sleep(3000)
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

const createDownloadWorkers = async (options) => {

  log.info(`Main: Descargas paralelas: ${MAX_DOWNLOAD_WORKERS}`)
  let downloadWorkers = []
  
  for (let i = 0; i < MAX_DOWNLOAD_WORKERS; i++) {
    const downloadWorker = createDownloadWorker(options)
    downloadWorkers.push(downloadWorker)
    
    await sleep(200)
  }

  return downloadWorkers
}

function createDownloadWorker(options) {
  log.info('Main: Creando nuevo download worker.')
  const workerURL = `${path.join(__dirname, 'download-worker.js')}`
  //options.token = currentToken
  const data = { workerData: { options } }
  const worker = new Worker(workerURL, data) 

  worker.on('message', (msg) => {

    if (msg.type === 'next') {
      try {
        const { ...callData } = getRecordsReadyToDownload(1)[0]
        log.info(`Main: Download Next ID ${callData.callID}`)
        updateRecords({idEstado: 3}, callData.callID)
        worker.postMessage({type: 'call', callData: callData})
      } catch (e) {
        log.error(`Main: No se encontraron nuevos registros en estado 'Listo Para Descargar'.`)
        worker.postMessage({type: 'end'})
      }
    }

    else if (msg.type === 'update') {
      log.info(`Main: CallID ${msg.callID} cambiando estado BD a ${msg.callData.idEstado}.`)
      updateRecords(msg.callData, msg.callID)
    }

    else if (msg.type === 'error') {
      log.info(`Main: ${msg.errorData.callID} - Guardando log de error de descarga`)
      const values = Object.values(msg.errorData).join(',') + '\n'
      saveDownloadError(errorLogPath, values)
    } 
    
    else if (msg.type === 'createNewWorker') {
      createDownloadWorker(options)
    }
    
    else if (msg.type === 'recorderNotLicensed') {
      currentEvent.sender.send('recorderNotLicensed')
      worker.postMessage({type: 'end'})
    }
    
  })

  return worker
}


const forceStopProcess = () => {
  log.info(`Main: Senal stop recibida. Forzando la finalizacion de procesos.`)
  
  currentEvent.sender.send('finishing')
  downloadRunning = false // Esto hara que la funcion ProcessPartialSearch detenga sus subprocesos pendientes
  stopSearchingProcess() //desloguea el worker y mata el proceso
  
  renewToken()
}

const stopSearchingProcess = async () => {
  try {
    searchWorker.postMessage({type: 'end'})
    log.info('Main: Busqueda terminada. Finalizando procesos.')
    await sleep(2000)
    currentEvent.sender.send('finishing')
    await sleep(2000)
    const successes = getTotalDownloads()[0].total
    const failures = getTotalErrors()[0].total
    const partials = getTotalPartials()[0].total
    currentEvent.sender.send('queryFinished',
                              {
                                successes: successes,
                                failures: failures,
                                partials: partials
                              })
    searchWorker = null
  } catch (error) {
    log.error(`Main: ${error}`)
  }
}

const logout = async (IP) => {
  await logoutRecorder(IP, currentToken)
  
}

 
module.exports = { beginDownloadCycle, runLoginEvent, logout, forceStopProcess }
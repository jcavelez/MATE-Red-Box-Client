const { webContents } = require('electron')
const log = require('electron-log')
const path = require('path')
const sleep = require('./sleep.js')
const counter = require('./assets/lib/counter.js')
const { ExternalCallIDCheck }= require('./assets/lib/EMTELCO.js')
const { logoutRecorder } = require('./recorderEvents.js')
const { placeNewSearch } = require('./recorderEvents.js')
const { getResults } = require('./recorderEvents.js')
const { getRecordsNoProcesed, getRecordsNoChecked, getRecordsReadyToDownload, updateRecords, getRPendingRecords, saveIDs
} = require('./databaseEvents')
const { Worker } = require('worker_threads')


let downloadRunning = false
let workers = []
let loginWorker = null
let currentToken = null
let loginError = null

let MAX_DOWNLOAD_WORKERS = 1
let currentEvent = null

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
    
    //TODO: envio mensaje a ipcrenderer porque desde este modulo no se puede importar
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
  currentEvent = event 
  log.info(`Main: Iniciando busqueda`)
  const client = options.client

  try {
    MAX_DOWNLOAD_WORKERS = options.parallelDownloads
  } catch (e) {
    log.error(`Main: opcion 'parallelDownloads' no configurado`)
  }
  
  downloadRunning = true
  event.sender.send('recorderSearching')
  await beginSearch(options)
  await createDetailsWorkers(options)
  await sleep(5000)
  specialClientChecks(client)
  await sleep(5000)
  event.sender.send('recorderDownloading')
  createDownloadWorkers(event, options)
  checkEnding()
}


const beginSearch = async (options) => {
  log.info('Main: solicitud busqueda')

  options.status = 'incomplete'
  options.resultsToSkip = 0
  options.progress = 0
  let searchStatus = await placeNewSearch(options, currentToken)

  if(searchStatus.hasOwnProperty('error')) {
    log.error(`Main: Error de busqueda recibido. Enviando a Renderer `)
    currentEvent.sender.send('searchError', {error: searchStatus.error})
    return
  }
  log.info(`Main: Estado de busqueda recibido del grabador. 'Results in range: ${searchStatus}'`)
  
  //se considera busqueda incompleta mientras placeNewSearch devuelva 
  //menos de 1000 resultados de acuerdo al API
  while (options.status === 'incomplete') {
    log.info(`Main: Descargando IDs'`)
    const newSearch = await getResults(options.lastRecorderIP, currentToken)
    if(newSearch) {
      log.info(`Main: Array de IDs recibido'`)
      options.resultsToSkip += newSearch.length
      const IDs = newSearch.map(res => res.callID)
      log.info('Main: Guardando resultados en BD')
      //ordenando resultados antes de guardarlos
      saveIDs(IDs.sort((a, b) => a - b))
      log.info(`Main: ${IDs.length} IDs guardados en BD`)
      
      if(newSearch.length == 1000) {
        log.info(`Main: Busqueda no completada. Ejecutando nueva busqueda`)
        searchStatus = await placeNewSearch(options, currentToken)
        log.info(`Main: ${searchStatus} Resultados`)
      } else {
        options.status = 'complete'
        log.info(`Main: Busqueda completada`)
      }

    } else {
        options.status = 'complete'
        log.info(`Main: Busqueda sin resultados`)
    }
  }
}

const createDetailsWorkers = async (options) => {
  try {
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
            if (!downloadRunning) {
              log.info(`Main: Eliminando worker ID ${worker.threadId}`)
              worker.postMessage({type: 'end'})
            }
            worker.postMessage({type: 'wait'})
          }
        } else if (msg.type === 'details') {
          log.info(`Main: CallID ${msg.callID}. Detalles de llamada recibidos`)
          updateRecords(msg.callData, msg.callID)
        } else if (msg.type === 'newToken') {
          log.info(`Main: CallID ${msg.callID}. Solicitud de nuevo token recibida.`)
          renewToken()
        }
      })
  
      workers.push(worker)
    }
    await sleep(2000)
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
          await sleep(10000)
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

const createDownloadWorkers = async (event, options) => {
  //let queryFails = counter()
  log.info(`Main: Descargas paralelas: ${MAX_DOWNLOAD_WORKERS}`)
  
  for (let i = 0; i < MAX_DOWNLOAD_WORKERS; i++) {
    log.info('Main: Creando nuevo download worker.')
    const workerURL = `${path.join(__dirname, 'download-worker.js')}`
    options.token = currentToken
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
          if (!downloadRunning) {
            log.info(`Main: Eliminando worker ID ${worker.threadId}`)
            worker.postMessage({type: 'end'})
          }
          worker.postMessage({type: 'wait'})
        }
      }
      else if (msg.type === 'update') {
        log.info(`Main: CallID ${msg.callID} cambiando estado BD.`)
        updateRecords(msg.callData, msg.callID)
      }
    })

    workers.push(worker)
    
  await sleep(1000)
  }
}

async function checkEnding() {
  while(downloadRunning) {
    await sleep(20000)
    const pending = getRPendingRecords()
    if(pending.length === 0) {
      downloadRunning = false
      stopDownload(currentEvent)
    }
  }
}


const stopDownload = async (event) => {
  log.info(`Main: Senal stop recibida. Esperando finalizacion de procesos pendientes.`)
  //time added to wait transcoding and report finished
  downloadRunning = false
  event.sender.send('finishing')
  
  log.info(`Main: Numero de workers creados:  ${workers.length}`)
  

  let workersActive = true

  //TO DO: poner limite de espera
  while(workersActive) {
    const threadIds = workers.map(w => w.threadId)
    if(threadIds.findIndex(id => id != -1) === -1) {
      workersActive = false
    } else {
      log.info(`Main: Se encontraron procesos pendientes. Esperando 10 segundos.`)
      await sleep(10000)
    }

  }

  workers = []
  event.sender.send('queryFinished')
  //renewToken()
}

const forceStopProcess = (event) => {
  log.info(`Main: Senal stop recibida. Forzando la finalizacion de procesos.`)
  //time added to wait transcoding and report finished
  downloadRunning = false
  event.sender.send('finishing')
  
  log.info(`Main: Numero de workers creados:  ${workers.length}`)
  
  workers.forEach(worker => {
    log.info(`Main: Eliminando worker ID ${worker.threadId}`)
    worker.postMessage({type: 'end'})
  })

  workers = []
  event.sender.send('queryFinished')
  renewToken()
}

const logout = async (IP) => {
  await logoutRecorder(IP, currentToken)
  
}

 
module.exports = { beginDownloadCycle, stopDownload, runLoginEvent, logout, forceStopProcess }
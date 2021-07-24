const log = require('electron-log')
const path = require('path')
const sleep = require('./sleep.js')
const counter = require('./assets/lib/counter.js')
const { ExternalCallIDCheck }= require('./assets/lib/EMTELCO.js')
const { loginRecorder, logoutRecorder } = require('./recorderEvents.js')
const { search } = require('./recorderEvents.js')
const { getRecordsNoProcesed, getRecordsNoChecked, getRecordsReadyToDownload, updateRecords 
} = require('./databaseEvents')
const { Worker } = require('worker_threads')


let downloadRunning = false
let login = {}
let workers = []
let loginWorker = null
let currentToken = null
let loginError = null

let MAX_DOWNLOAD_WORKERS = 1

async function runLoginEvent(event, loginData) {
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
    log.info(msg)
    if(msg.type === 'token') {
      currentToken = msg.data
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
    loginWorker.postMessage({type: 'getToken'})
    //esperamos hasta que tengamos el token o un error
    await sleep(500)
    while (currentToken == null && loginError == null) {
      loginWorker.postMessage({type: 'getToken'})
      await sleep(2000)
    }
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


const beginDownloadCycle = async (event, options) => {
  log.info(`Main: Iniciando busqueda`)
  const client = options.client

  MAX_DOWNLOAD_WORKERS = options.parallelDownloads
  
  downloadRunning = true
  event.sender.send('recorderSearching')
  await beginSearch(options)
  getDetails(options)
  await sleep(500)
  specialClientChecks(client)
  event.sender.send('recorderDownloading')
  download(event, options)
}


const beginSearch = async (options) => {
  log.info('Main: solicitud busqueda')
  let nResults =  await search(options, currentToken)
  log.info(`Main: ${nResults} resultados recibidos`)
}

const getDetails = async (options) => {
  try {
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
          worker.postMessage({type: 'call', callID: id})
        } catch (e) {
          log.error(`Main: Termina proceso de descarga de detalles de llamada`)
          worker.postMessage({type: 'finish'})
          await sleep(1000)
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

const download = async (event, options) => {
  let queryFails = counter()
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
          updateRecords({idEstado: 2}, callData.callID)
          worker.postMessage({type: 'call', callData: callData})
        } catch (e) {
          log.error(`Main: No se encontraron nuevas grabaciones en estado Listo Para Descargar.`)
          queryFails.increment()
          queryFails.value() >= 5 ? stopDownload(event, options.lastRecorderIP) : worker.postMessage({type: 'wait'})
        }
      }
      else if (msg.type === 'update') {
        log.info(`Main: CallID ${msg.callID} cambiando estado BD.`)
        updateRecords(msg.callData, msg.callID)
      }
    })

    workers.push(worker)
    
  await sleep(100)
  }
}


const stopDownload = async (event, IP) => {
  log.info(`Main: Senal stop recibida. Eliminando procesos`)
  //time added to wait transcoding and report finished
  await sleep(10000)

  workers.forEach(worker => {
    worker.terminate()
    worker.unref()
  })
  workers = []
  downloadRunning = false
  
  logoutRecorder(IP, currentToken)
  event.sender.send('queryFinished')
}

 
module.exports = { beginDownloadCycle, stopDownload, runLoginEvent }
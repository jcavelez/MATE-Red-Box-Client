const log = require('electron-log')
const path = require('path')
const sleep = require('./sleep.js')
const counter = require('./assets/lib/counter.js')
const { ExternalCallIDCheck }= require('./assets/lib/EMTELCO.js')
const { logoutRecorder } = require('./recorderEvents.js')
const { search } = require('./recorderEvents.js')
const { getRecordsNoProcesed, getRecordsNoChecked, getRecordsReadyToDownload, updateRecords 
} = require('./databaseEvents')
const { Worker } = require('worker_threads')


let downloadRunning = false
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
  log.info(`Main: Iniciando busqueda`)
  const client = options.client

  MAX_DOWNLOAD_WORKERS = options.parallelDownloads
  
  downloadRunning = true
  event.sender.send('recorderSearching')
  await beginSearch(options)
  getDetails(options)
  await sleep(1000)
  specialClientChecks(client)
  await(1000)
  event.sender.send('recorderDownloading')
  download(event, options)
}


const beginSearch = async (options) => {
  log.info('Main: solicitud busqueda')
  let numResults =  await search(options, currentToken)
  log.info(`Main: ${numResults} resultados recibidos`)
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
          worker.unref()
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
          log.error(`Main: No se encontraron nuevos registros en estado 'Listo Para Descargar'.`)
          queryFails.increment()
          queryFails.value() == 5 ? stopDownload(event, options.lastRecorderIP) : worker.postMessage({type: 'wait'})
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


const stopDownload = async (event) => {
  log.info(`Main: Senal stop recibida. Eliminando procesos.`)
  //time added to wait transcoding and report finished
  event.sender.send('finishing')
  downloadRunning = false
  await sleep(15000)
  event.sender.send('queryFinished')


  log.info(`Main: Numero de workers activos:  ${workers.length}`)
  
  workers.forEach(worker => {
    log.info(`Main: Eliminando worker ID ${worker.threadId}`)
    worker.terminate()
  })
  workers = []
  renewToken()
}

const logout = async (IP) => {
  await logoutRecorder(IP, currentToken)
  
}

 
module.exports = { beginDownloadCycle, stopDownload, runLoginEvent, logout }
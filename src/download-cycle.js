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

let MAX_DOWNLOAD_WORKERS = 1


const beginDownloadCycle = async (event, options) => {
  const recorderIP = options.lastRecorderIP
  const username = options.username
  const password = options.password
  const client = options.client

  MAX_DOWNLOAD_WORKERS = options.parallelDownloads

  await getToken(recorderIP, username, password)
  if (await checkToken(event)) {
    downloadRunning = true
    await beginSearch(options)
    await logoutRecorder(recorderIP, login.authToken)

    getDetails(options)
    await sleep(3000)
    specialClientChecks(client)
    download(event, options)
  }
}

const getToken = async (recorderIP, username, password) => {
  log.info('Main: Solicitud login ' + recorderIP)
  login = await loginRecorder(recorderIP, username, password)
}

const checkToken = async (event) => {
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

const beginSearch = async (options) => {
  log.info('Main: solicitud busqueda')
  let nResults =  await search(options, login.authToken)
  log.info(`Main: ${nResults} resultados recibidos`)
}

const getDetails = async (options) => {
  try {
    log.info('Main: Creando nuevo worker.')
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
    
  try {
    
    if (client === 'EMTELCO') {
      log.info(`Client Checks: EMTELCO`)

      //downloadRunning modificado a false en stop search
      await sleep(1000)
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
  event.sender.send('recorderDownloading')
  let queryFails = counter()
  log.info(`Main: Descargas paralelas: ${MAX_DOWNLOAD_WORKERS}`)
  
  for (let i = 0; i < MAX_DOWNLOAD_WORKERS; i++) {
    log.info('Main: Creando nuevo worker.')
    const workerURL = `${path.join(__dirname, 'download-worker.js')}`
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
          queryFails.value() >= 5 ? stopDownload(event, options.lastRecorderIP, login.authToken) : worker.postMessage({type: 'wait'})
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


const stopDownload = async (event, IP, token) => {
  log.info(`Main: Senal stop recibida. Eliminando procesos`)
  //time added to wait transcoding and report finished
  await sleep(10000)

  workers.forEach(worker => {
    worker.terminate()
    worker.unref()
  })
  workers = []
  downloadRunning = false
  
  logoutRecorder(IP, token)
  event.sender.send('queryFinished')
}

 
module.exports = { beginDownloadCycle, stopDownload }
'use strict'

const { parentPort, workerData, threadId } = require('worker_threads')
const { placeNewSearch } = require('./recorderEvents.js')
const { loginRecorder, logoutRecorder, keepAlive, getResults } = require('./recorderEvents.js')
const sleep = require('./sleep.js')

const log = require('electron-log')
log.transports.file.level = 'error'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'

log.info(`Worker Search ID ${threadId}: Creado`)

let options = workerData.options
const IP = options.lastRecorderIP
const username = options.username
const password = options.lastPassword
let currentToken = null
options.status = 'incomplete'
options.resultsToSkip = 0
options.progress = 0


parentPort.on('message', async (msg) => {

    if (msg.type == 'search') {
      const res = await login()
      await checkLogin(res)
      keepSession()
      await newSearch()
    } 

    else if (msg.type == 'updateSearch') {
      log.info(`Worker Search ID ${threadId}: Actualizando busqueda modo persistente`)

      options.resultsToSkip = 0
      options.progress = 0
      options.status = 'incomplete'
      options.startTime = msg.newStartTime
      options.endTime = msg.newEndTime

      await newSearch()
    }
    
    else if (msg.type === 'end') {
        log.info(`Worker Search ID ${threadId}: exit()`)
        await logout()
        process.exit(0)
    }

})


const newSearch = async () => {

    log.info(`Worker Search ID ${threadId}: Iniciando busqueda`)
    
    let searchStatus = await placeNewSearch(options, currentToken)

    if(searchStatus.hasOwnProperty('error')) {
      log.error(`Worker Search ID ${threadId}: Error de busqueda recibido. Enviando a Renderer `)
      // -> currentEvent.sender.send('searchError', {error: searchStatus.error})
      options.status = 'complete'
      parentPort.postMessage({type: 'error', error: searchStatus.error})
      return
    }

    log.info(`Worker Search ID ${threadId}: Estado de busqueda recibido del grabador. Estado: ${searchStatus.statusShort}`)

    //si el grabador tuvo una respuesta correcta
    if (searchStatus.hasOwnProperty('resultsFound')) { 
      if(searchStatus.resultsFound == '0') {
        options.status = 'complete'
        parentPort.postMessage({type: 'error', error: 'Busqueda sin resultados'})
        return
      }
    }
    
    //se considera busqueda incompleta mientras placeNewSearch devuelva 
    //menos de 1000 resultados de acuerdo al API
    if (options.status === 'incomplete') {
      log.info(`Worker Search ID ${threadId}: Descargando IDs'`)
      const newSearchResults = await getResults(options.lastRecorderIP, currentToken)

      if(newSearchResults) {
        log.info(`Worker Search ID ${threadId}: Array de IDs recibido'`)
        options.resultsToSkip += newSearchResults.length
        const IDs = newSearchResults.map(res => res.callID)
        log.info(`Worker Search ID ${threadId}: Guardando resultados en BD`)
    
        parentPort.postMessage({type: 'results', IDs: IDs})
  
      } else {
          options.status = 'complete'

          parentPort.postMessage({type: 'complete'})

          log.info(`Worker Search ID ${threadId}: Busqueda sin resultados`)
      }
    }
  }

async function login () {
  log.info(`Worker Search ID ${threadId}: Solicitud login a ${IP}`)
  const res = await loginRecorder(IP, username, password)
  return res
    
}

async function checkLogin (response) {
  if (response.hasOwnProperty('authToken')) {
    log.info(`Worker Search ID ${threadId}: Login OK`)
    currentToken = response.authToken
    //loginError = null
    return true
  } else if (response.hasOwnProperty('error')) {
    log.error(`Worker Search ID ${threadId}: Validando login Error:  ${response.error}`)
    currentToken = null
    //loginError = response.error
    return false
  }
  else {
    log.error(`Worker Search ID ${threadId}: Validando login Error:  ${response.type} ${response.errno}`)
    currentToken = null
    //loginError = response.type + ' ' + response.errno
    return false
  }
}

async function logout () {
  log.info(`Worker Search ID ${threadId} : Loging out ${IP}`)
  const res = await logoutRecorder(IP, currentToken)
  currentToken = null
}
  
async function keepSession() {

  while(true) {
      await sleep(290000)
      log.info(`Worker Search ID ${threadId}: Enviando keep alive`)
      const res = await keepAlive(IP, currentToken)

      if(res.hasOwnProperty('error')) {
          log.error(`Worker Search ID ${threadId}: Error ${res.error}`)
          logout()
          const r = await login()
          await checkLogin(r)
      }
  }
  
}


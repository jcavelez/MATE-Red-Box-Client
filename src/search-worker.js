'use strict'

const { parentPort, workerData, threadId } = require('worker_threads')
const { placeNewSearch } = require('./recorderEvents.js')
const { getResults } = require('./recorderEvents.js')
const sleep = require('./sleep.js')

const log = require('electron-log')
log.transports.file.level = 'error'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'

log.info(`Worker Search ID ${threadId}: Creado`)

let options = workerData.options
options.status = 'incomplete'
options.resultsToSkip = 0
options.progress = 0

let token = options.token

parentPort.on('message', async (msg) => {

    if (msg.type == 'search') {
        await newSearch()
    } 
    
    else if (msg.type === 'end') {
        log.info(`Worker Search ID ${threadId}: exit()`)
        process.exit(0)
    }

})


const newSearch = async () => {
    log.info(`Worker Search ID ${threadId}: Iniciando busqueda`)
    
    let searchStatus = await placeNewSearch(options, token)

    if(searchStatus.hasOwnProperty('error')) {
      log.error(`Worker Search ID ${threadId}: Error de busqueda recibido. Enviando a Renderer `)
      // -> currentEvent.sender.send('searchError', {error: searchStatus.error})
      options.status = 'complete'
      parentPort.postMessage({type: 'error', error: searchStatus.error})
      return
    }

    log.info(`Worker Search ID ${threadId}: Estado de busqueda recibido del grabador. Estado: ${searchStatus.statusShort}`)


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
      const newSearchResults = await getResults(options.lastRecorderIP, token)

      if(newSearchResults) {
        log.info(`Worker Search ID ${threadId}: Array de IDs recibido'`)
        options.resultsToSkip += newSearchResults.length
        const IDs = newSearchResults.map(res => res.callID)
        log.info(`Worker Search ID ${threadId}:Guardando resultados en BD`)
    
        parentPort.postMessage({type: 'results', IDs: IDs})
  
      } else {
          options.status = 'complete'

          parentPort.postMessage({type: 'complete'})

          log.info(`Worker Search ID ${threadId}: Busqueda sin resultados`)
      }
    }
  }


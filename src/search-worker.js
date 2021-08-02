'use strict'

const { parentPort, workerData, threadId } = require('worker_threads')
const { placeNewSearch } = require('./recorderEvents.js')
const { getResults } = require('./recorderEvents.js')
const sleep = require('./sleep.js')

const log = require('electron-log')
log.transports.file.level = 'info'
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

    log.info(options)

    let searchStatus = await placeNewSearch(options, token)
  
    if(searchStatus.hasOwnProperty('error')) {
      log.error(`Worker Search ID ${threadId}: Error de busqueda recibido. Enviando a Renderer `)
      // -> currentEvent.sender.send('searchError', {error: searchStatus.error})
      return
    }
    log.info(`Worker Search ID ${threadId}: Estado de busqueda recibido del grabador. 'Results in range: ${searchStatus}'`)
    
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
  
        
        // if(newSearchResults.length == 1000) {
        //   log.info(`Main: Busqueda no completada. Ejecutando nueva busqueda`)
        //   searchStatus = await placeNewSearch(options, currentToken)
        //   log.info(`Main: ${searchStatus} Resultados`)
        // } else {
        //   options.status = 'complete'
        //   log.info(`Main: Busqueda completada`)
        // }
  
      } else {
          options.status = 'complete'

          parentPort.postMessage({type: 'complete'})

          log.info(`Worker Search ID ${threadId}: Busqueda sin resultados`)
      }
    }
  }

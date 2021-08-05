'use strict'

const { parentPort, workerData, threadId } = require('worker_threads')
const sleep = require('./sleep.js')

const log = require('electron-log')
log.transports.file.level = 'info'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'

log.info(`Worker Download Details ID ${threadId}: Creado`)

const IP = workerData.options.lastRecorderIP
let token = workerData.options.token

parentPort.on('message', async (msg) => {

    if (msg.type == 'call') {

        if (token) {
            await processCall(msg.callID)
        } else {
            log.error(`Worker Download Details ID ${threadId}: Call ID ${msg.callID} - No hay token disponible`)
            parentPort.postMessage({type: 'update', callID: msg.callID, callData: {idEstado: 0} })
            parentPort.postMessage({type: 'newToken'})
            await sleep(2000)
        }

        await sleep(200)
        
        parentPort.postMessage({type: 'next'})

    } 
    
    else if (msg.type === 'wait') {
        await sleep(10000)
        parentPort.postMessage({type: 'next'})
    } 
    
    else if (msg.type === 'updatedToken') {
        token = msg.token
    } 
    
    else if (msg.type === 'end') {
        log.info(`Worker Download Details ID ${threadId}: exit()`)
        process.exit(0)
    }

})


parentPort.postMessage({type: 'next'})

async function processCall(callID) {
    log.info(`Worker Download Details ID ${threadId}: CallID ${callID} - Inicio procesamiento `)
    const { downloadDetails } = require('./recorderEvents.js')
    let callData

    let {...dets} = await downloadDetails(IP, token, callID)

    if (dets.hasOwnProperty('error')) {
        log.error(`Worker Download Details ID ${threadId}: Call ID ${callID} - ${dets.error}`)
        parentPort.postMessage({type: 'update', callID: callID, callData: {idEstado: 0} })
        if (dets.error === 'The authentication token is invalid.') {
            token = null
            parentPort.postMessage({type: 'newToken'})
            await sleep(2000)
        }
        return dets.error
    }

    //Solamente se guardan los campos que coincidan con los creados en schema de la BD
    callData = {
        StartDateTime: dets.StartDateTime,
        EndDateTime: dets.EndDateTime,
        Duration: dets.Duration,
        Direction: dets.Direction,
        Extension: dets.Extension,
        ChannelName: dets.ChannelName,
        OtherParty: dets.OtherParty,
        AgentGroup: dets.AgentGroup,
        RBRCallGUID: dets.RBRCallGUID,
        ExternalCallID: dets.hasOwnProperty('ExternalCallID') ? dets.ExternalCallID : '',
        idEstado: 2
    }

    parentPort.postMessage({type: 'details', callID: callID, callData: callData})
    log.info(`Worker Download Details ID ${threadId}: Call ID ${callID} - Enviando details a main`)
    //tiempo para que guarde data en bd
    await sleep(100)
    
}

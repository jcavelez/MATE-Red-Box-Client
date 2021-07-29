'use strict'

const log = require('electron-log')
const { parentPort, workerData, threadId } = require('worker_threads')
const sleep = require('./sleep.js')

log.info(`Worker Download Details ID ${threadId}: Creado`)

const IP = workerData.options.lastRecorderIP
let token = workerData.options.token

parentPort.on('message', async (msg) => {

    if (msg.type == 'call') {
        
        token ? await processCall(msg.callID) : parentPort.postMessage({type: 'update', callID: msg.callID, callData: {idEstado: 0} })

        await sleep(200)
        
        parentPort.postMessage({type: 'next'})

    } 
    
    else if (msg.type === 'wait') {
        await sleep(5000)
        parentPort.postMessage({type: 'next'})
    } 
    
    else if (msg.type === 'updatedToken') {
        token = msg.token
    } 
    
    else if (msg.type === 'end') {
        process.exit(0)
    }

})


parentPort.postMessage({type: 'next'})

async function processCall(callID) {
    log.info(`Worker Download Details ID ${threadId}: Inicio procesamiento CallID ${callID}`)
    const { downloadDetails } = require('./recorderEvents.js')
    let callData

    let {...dets} = await downloadDetails(IP, token, callID)

    if (dets.hasOwnProperty('error')) {
        parentPort.postMessage({type: 'update', callID: ID, callData: {idEstado: 0} })
        if (dets.error === 'The authentication token is invalid.') {
            token = null
            parentPort.postMessage({type: 'newToken'})
        }
        return dets.error
    }

    //special check for EMTELCO recorder
    if (dets.hasOwnProperty('ExternalCallID') === false) {
        dets.ExternalCallID = ''
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
        ExternalCallID: dets.ExternalCallID,
        idEstado: 2
    }

    parentPort.postMessage({type: 'details', callID: callID, callData: callData})
    log.info(`Worker Download Details ID ${threadId}: Envido details Call ID ${callID} a main`)
    //tiempo para que guarde data en bd
    await sleep(100)
    
    
}

function renewToken() {
    
}
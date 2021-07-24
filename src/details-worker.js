'use strict'

const log = require('electron-log')
const { parentPort, workerData } = require('worker_threads')
const { loginRecorder } = require('./recorderEvents.js')
const { logoutRecorder } = require('./recorderEvents.js')

log.info(`Worker Download Details: Creado`)

const IP = workerData.options.lastRecorderIP
let token = workerData.options.token

parentPort.on('message', (msg) => {
    if (msg.type == 'call') {
        processCall(msg.callID)
    }
})


parentPort.postMessage({type: 'next'})

async function processCall(callID) {
    log.info(`Worker Download Details: Inicio procesamiento CallID ${callID}`)
    const { downloadDetails } = require('./recorderEvents.js')
    let callData

    let {...dets} = await downloadDetails(IP, token, callID)

    if (dets.hasOwnProperty('error')) {
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
        idEstado: 1
    }

    parentPort.postMessage({type: 'details', callID: callID, callData: callData})
    parentPort.postMessage({type: 'next'})
    
}


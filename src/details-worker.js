'use strict'

const log = require('electron-log')
const { parentPort, workerData } = require('worker_threads')

log.info(`Worker Download Details: Creado`)

const IP = workerData.IP
const token = workerData.token

parentPort.on('message', processCall)

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
        //dets.ExternalCallID = dets.ExternalCallID === '' ? ExternalCallIDCheck(dets) : dets.ExternalCallID
        //await checkExternalCallID()
        dets.ExternalCallID = ''
    }

    //Getting important data only that matches with database fields
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
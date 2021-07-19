'use strict'

const log = require('electron-log')
const { parentPort, workerData } = require('worker_threads')
const { loginRecorder } = require('./recorderEvents.js')
const { logoutRecorder } = require('./recorderEvents.js')

log.info(`Worker Download Details: Creado`)

const IP = workerData.options.lastRecorderIP
const username = workerData.options.username
const password = workerData.options.password
let token

parentPort.on('message', (msg) => {
    if (msg.type == 'call') {
        processCall(msg.callID)
    } else if (msg.type == 'finish') {
        logoutRecorder(IP, token)
    }
});

(async () => {
    const login = await loginRecorder(IP, username, password)
    if (await checkToken(login)) {
        log.info(`Worker Download Details: Solicitando nuevo Call ID`)
        token = login.authToken 
        parentPort.postMessage({type: 'next'})
    }
})()

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

const checkToken = async (login) => {
    if (login.hasOwnProperty('authToken')) {
        log.info(`Worker Download Details: Login exitoso`)
        return true
    }
    else if (login.hasOwnProperty('error')) {
        return false
    }
    else {
        log.error(`Worker Download Audio ID: Login fallido ${login.type} - ${login.errno}`)
        return false
    }
}
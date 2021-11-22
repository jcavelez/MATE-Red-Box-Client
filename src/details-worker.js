'use strict'

const { parentPort, workerData, threadId } = require('worker_threads')
const { loginRecorder, logoutRecorder, keepAlive } = require('./recorderEvents.js')
const sleep = require('./sleep.js')
const log = require('electron-log')
log.transports.file.level = 'error'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'

log.info(`Worker Download Details ID ${threadId}: Creado`)

const IP = workerData.options.lastRecorderIP
let username = workerData.options.username
let password = workerData.options.lastPassword

let currentToken = null
let loginError = null;

(async () => {
    const res = await login()
    await checkLogin(res)
    keepSession()
    parentPort.postMessage({type: 'next'})
  }
)();

parentPort.on('message', async (msg) => {

    log.info(`Worker Download Details ID ${threadId}: Mensaje recibido: ${msg}`)

    if (msg.type == 'call') {

        if (currentToken) {
            await processCall(msg.callID)
        } else {
            log.error(`Worker Download Details ID ${threadId}: Call ID ${msg.callID} - No hay token disponible`)
            parentPort.postMessage({type: 'update', callID: msg.callID, callData: {idEstado: 0}})
            const res = await login()
            await checkLogin(res)
            //await sleep(2000)
        }

        await sleep(200)
        
        parentPort.postMessage({type: 'next'})

    } 
    
    else if (msg.type === 'end') {
        log.info(`Worker Download Details ID ${threadId}: exit()`)
        process.exit(0)
    }

    else if (msg.type === 'wait') {
        await sleep(10000)
        parentPort.postMessage({type: 'next'})
    } 

})


//parentPort.postMessage({type: 'next'})

async function processCall(callID) {
    log.info(`Worker Download Details ID ${threadId}: CallID ${callID} - Inicio descarga de metada`)
    const { downloadDetails } = require('./recorderEvents.js')
    let callData

    let {...dets} = await downloadDetails(IP, currentToken, callID)

    if (dets.hasOwnProperty('error')) {
        log.error(`Worker Download Details ID ${threadId}: Call ID ${callID} - ${dets.error}`)
        parentPort.postMessage({type: 'update', callID: callID, callData: {idEstado: 0} })

        if (dets.error === 'The authentication token is invalid.') {
            logout()
            const res = await login()
            await checkLogin(res)
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

async function login() {
    log.info(`Worker Download Details ID ${threadId}: Solicitud login a ${IP}`)
    const res = await loginRecorder(IP, username, password)
    return res
}

async function checkLogin(response) {
    if (response.hasOwnProperty('authToken')) {
      log.info(`Worker Download Details ID ${threadId}: Login OK`)
      currentToken = response.authToken
      loginError = null
      return true
    } else if (response.hasOwnProperty('error')) {
      log.error(`Worker Download Details ID ${threadId}: Validando login Error:  ${response.error}`)
      currentToken = null
      loginError = response.error
      return false
    }
    else {
      log.error(`Worker Download Details ID ${threadId}: Validando login Error:  ${response.type} ${response.errno}`)
      currentToken = null
      loginError = response.type + ' ' + response.errno
      return false
    }
  }

async function logout() {
    log.info(`Worker Download Details ID ${threadId}: Loging out ${IP}`)
    await logoutRecorder(IP, currentToken)
    currentToken = null
  }
  
async function keepSession() {

    while(true) {
        await sleep(290000)
        log.info(`Worker Download Details ID ${threadId}: Enviando keep alive`)
        const res = await keepAlive(IP, currentToken)

        if(res.hasOwnProperty('error')) {
            log.error(`Worker Download Details ID ${threadId}: Error ${res.error}`)
            logout()
            const r = await login()
            await checkLogin(r)
        }
    }
  
}
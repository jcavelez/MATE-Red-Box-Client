'use strict'

const log = require('electron-log')
const sleep = require('./sleep.js')
const { loginRecorder, logoutRecorder } = require('./recorderEvents.js')
const { parentPort, workerData, threadId } = require('worker_threads')

log.info(`Worker Download Audio ID ${threadId}: Creado`)

let downloadOptions = workerData.options
const IP = downloadOptions.lastRecorderIP
let username = downloadOptions.username
let password = downloadOptions.password
const downloadPath = downloadOptions.downloadPath
let currentToken = null 
let loginError = null;

(async () => {
    await login()
    keepSession()
  }
)()


parentPort.on('message', async (msg) => {
    if (msg.type === 'call') {
        const ID = msg.callData.callID
        if(currentToken) {
            await processCall(msg.callData) 
        } else {
            log.info(`Worker Download Audio ID ${threadId}: Call ID ${ID} - No hay token disponible para la descarga.`)
            await login()
            parentPort.postMessage({type: 'update', callID: ID, callData: {idEstado: 2} })
            await sleep(200)
        }
        log.info(`Worker Download Audio ID ${threadId}: Solicitando otro Call ID para descarga`)
        parentPort.postMessage({type: 'next'}) 

    }
    
    else if (msg.type === 'end') {
        await logout()
        log.info(`Worker Download Audio ID ${threadId}: Exit`)
        process.exit(0)

    }
    
    else if (msg.type === 'wait') {
        await sleep(10000)
        parentPort.postMessage({type: 'next'})
    }
})

parentPort.postMessage({type: 'next'})

async function login () {
    log.info(`Worker Download Audio ID ${threadId}: Solicitud login a ${IP}`)
    const res = await loginRecorder(IP, username, password)
    await checkLogin(res)
}

async function checkLogin (response) {
    if (response.hasOwnProperty('authToken')) {
      log.info(`Worker Download Audio ID ${threadId}: Login OK`)
      currentToken = response.authToken
      loginError = null
    } else if (response.hasOwnProperty('error')) {
      log.error(`Worker Download Audio ID ${threadId}: Validando login Error:  ${response.error}`)
      currentToken = null
      loginError = response.error
    }
    else {
      log.error(`Worker Download Audio ID ${threadId}: Validando login Error:  ${response.type} ${response.errno}`)
      currentToken = null
      loginError = response.type + ' ' + response.errno
    }
  }

async function processCall(callData) {
    const { downloadAudio } = require('./recorderEvents.js')
    
    const callID = callData.callID

    log.info(`Worker Download Audio ID ${threadId}: CallID ${callData.callID} -  Solicitando descarga`)

    let { ...download } = await downloadAudio(IP, currentToken, callID, downloadPath)
    
    log.info(`Worker Download Audio ID ${threadId}: CallID ${callData.callID} - Descarga terminada`)
    
    callData = { ...callData, ...download }

    if (download.hasOwnProperty('error')) {
        log.error(`Worker Download Audio ID ${threadId}: CallID ${callData.callID} - ${download.error}`)
        parentPort.postMessage({
                                type: 'update',
                                callID: callID,
                                callData:
                                        {
                                            idEstado: 6,
                                            respuestaGrabador: download.error
                                        }
                                })
        await sleep(500)
        parentPort.postMessage({type: 'next'})
        return
    } else {
        //Estado: descargado
        callData.idEstado = 4
    }
    
    const newData = {
                        idEstado: callData.idEstado,
                        respuestaGrabador: callData.respuestaGrabador,
                        ruta: callData.ruta,
                        fechaDescarga: callData.fechaDescarga
                    }

    parentPort.postMessage({type: 'update', callID: callID, callData: newData })
    await postDownloadTasks(callID, callData)
}

async function postDownloadTasks(callID, callData) {
    const { convert } = require('./ffmpegEvents.js')
    const { createNewFileName, createReport, saveReport } = require('./reportEvents.js')

    
    const outputFormat = downloadOptions.outputFormat
    let ruta = callData.ruta
    const overwrite = downloadOptions.overwrite
    //const AgentGroup = callData.AgentGroup
    const StartDateTime = callData.StartDateTime
    
    if (callData.idEstado === 4) {
        const dstFile = createNewFileName(callData, outputFormat)
        log.info(`PostDownloadTasks: CallID ${callID} - Nuevo nombre ${dstFile}`)
        
        if (downloadOptions.outputFormat != 'wav') {
            log.info(`PostDownloadTasks: CallID ${callID} - Solicitud transcoding.`)
            callData.idEstado = 5
            parentPort.postMessage({type: 'update', callID: callID, callData: {idEstado: 5} })
            await convert(ruta, outputFormat, dstFile, overwrite)
                        .then(() => {
                            ruta = callData.ruta = dstFile
                            callData.idEstado = 6
                        })
                        .catch(() => {
                            log.error(`PostDownloadTasks: CallID ${callID} Promise rejected`)
                            callData.idEstado = 7
                        })
                        
                    }
        if (downloadOptions.report === 'yes') {
            const headers = Object.keys(callData).join(',') + '\n'
            const reportFile = await createReport(ruta, StartDateTime, headers)
            const values = Object.values(callData).join(',') + '\n'
            saveReport(reportFile, values)
            log.info(`PostDownloadTasks: CallID ${callID} - Reporte guardado.`)
        }
    }

    parentPort.postMessage({type: 'update', callID: callID, callData })
    log.info(`PostDownloadTasks: CallID ${callID} - Solicitando actualizacion en BD.`)
}

async function logout () {
    log.info(`Worker Download Audio ID ${threadId} : Solicitud logout a ${IP}`)
    const res = await logoutRecorder(IP, currentToken)
  }
  
async function keepSession() {

    while(true) {
        await sleep(290000)
        log.info(`Worker Login: Enviando keep alive`)
        const res = await keepAlive(IP, currentToken)

        if(res.hasOwnProperty('error')) {
            log.error(`Worker Login: Error ${res.error}`)
            logout()
            await login()
        }
}
  
  }
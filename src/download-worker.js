'use strict'

const sleep = require('./sleep.js')
const { loginRecorder, logoutRecorder, keepAlive } = require('./recorderEvents.js')
const { parentPort, workerData, threadId } = require('worker_threads')

const log = require('electron-log')
log.transports.file.level = 'error'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'

log.info(`Worker Download Audio ID ${threadId}: Creado`)

//console.log(workerData.options)

let downloadOptions = workerData.options
const IP = downloadOptions.lastRecorderIP
let username = downloadOptions.username
let password = downloadOptions.lastPassword
const downloadPath = downloadOptions.downloadPath
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
    if (msg.type === 'call') {

        const ID = msg.callData.callID

        if(currentToken) {
            await processCall(msg.callData) 
        } else {
            log.info(`Worker Download Audio ID ${threadId}: Call ID ${ID} - No hay token disponible para la descarga.`)
            const res = await login()
            await checkLogin(res)
            parentPort.postMessage({type: 'update', callID: ID, callData: {idEstado: 2} })
            await sleep(200)
        }
        log.info(`Worker Download Audio ID ${threadId}: Solicitando otro Call ID para descarga`)
        parentPort.postMessage({type: 'next'}) 

    }
    
    else if (msg.type === 'end') {
        await logout()
        log.info(`Worker Download Audio ID ${threadId}: exit()`)
        process.exit(0)

    }
    
    else if (msg.type === 'wait') {
        await sleep(10000)
        parentPort.postMessage({type: 'next'})
    }
})



async function processCall(callData) {
    const { downloadAudio } = require('./recorderEvents.js')
    
    const callID = callData.callID

    log.info(`Worker Download Audio ID ${threadId}: CallID ${callID} -  Solicitando descarga`)

    let download = await downloadAudio(IP, currentToken, callID, downloadPath)

    log.info(`Worker Download Audio ID ${threadId}: CallID ${callID} -  Respuesta recibida`)
    
    callData = { ...callData, ...download }

    if (download.hasOwnProperty('error') || download == {}) {
        log.error(`Worker Download Audio ID ${threadId}: CallID ${callID} - ${download.error}`)

        const msgUpdate =  {
            type: 'update',
            callID: callID,
            callData:
                {
                    idEstado: 7,
                    respuestaGrabador: download.error
                }
        }
    
        parentPort.postMessage(msgUpdate)

        //se envia toda la data para ser guardada en archivo de log de errores de descarga
        const msgError = {
            type: 'error', 
            errorData: {
                callID: callID,
                status: download.status,
                statusText: download.statusText,
                errorType: download.error,
                StartDateTime: callData.StartDateTime,
                EndDateTime: callData.EndDateTime,
                Duration: callData.Duration,
                Direction: callData.Direction,
                Extension: callData.Extension,
                ChannelName: callData.ChannelName,
                OtherParty: callData.OtherParty,
                AgentGroup: callData.AgentGroup,
                RBRCallGUID: callData.RBRCallGUID,
                ExternalCallID: callData.ExternalCallID
            }
        }

        //await sleep(500)

        parentPort.postMessage(msgError)
        
        //Eventos en los que es recomendable matar el proceso y crear uno nuevo
        if (download.error == 'Internal error.') {
            log.error(`Worker Download Audio ID ${threadId}: Deteniendo proceso`)
            //Tiempo para que se recupere el REST API de la grabadora
            await sleep(3000)
            await logout()
            parentPort.postMessage({type: 'update', callID: callID, callData: {idEstado: 2} })
            //tiempo para no bloquear la BD
            await sleep(200)
            parentPort.postMessage({type: "createNewWorker"})
            process.exit()
        }

        //Evento en el que se renueva el login, pero no se mata el proceso
        else if (download.error == 'The authentication token is invalid.') {
            log.error(`Worker Download Audio ID ${threadId}: Renovando login`)
            await logout()
            const res = await login()
            await checkLogin(res)
            parentPort.postMessage({type: 'update', callID: callID, callData: {idEstado: 2} })
            await sleep(500)
            parentPort.postMessage({type: 'next'})
        }
        
        //Igual que en internal error, pero sin crear el nuevo worker.
        //Main se encarga de enviar la senal de cierre del proceso y logout
        else if (download.error == 'RB_RS_RECORDER_NOT_LICENSED') {
            log.error(`Worker Download Audio ID ${threadId}: ${download.error}`)
            log.error(`Worker Download Audio ID ${threadId}: Grabadora no licenciada. Eliminando worker`)
            parentPort.postMessage({type: 'update', callID: callID, callData: {idEstado: 2} })
            await sleep(500)
            parentPort.postMessage({type: 'recorderNotLicensed'})
        }
        
        //Evento en el que solo devolvemos la grabacion al estado anterior
        else if (download.error == 'RB_RS_TRANSFER_ABORTED') {
            parentPort.postMessage({type: 'update', callID: callID, callData: {idEstado: 2} })
            await sleep(500)
            parentPort.postMessage({type: 'next'})
        }
        
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
    log.info(`Worker Download Audio ID ${threadId}: CallID ${callID} - Cambiando estado a ${callData.idEstado}`)
    parentPort.postMessage({type: 'update', callID: callID, callData: newData })
    await postDownloadTasks(callID, callData)
}

async function postDownloadTasks(callID, callData) {
    const { convert } = require('./ffmpegEvents.js')
    const { createNewFileName, createReport, saveReport } = require('./reportEvents.js')

    
    const outputFormat = downloadOptions.outputFormat
    let ruta = callData.ruta
    const overwrite = downloadOptions.overwrite
    const StartDateTime = callData.StartDateTime
    
    if (callData.idEstado === 4) {
        const dstFile = createNewFileName(callData, downloadOptions)
        log.info(`PostDownloadTasks: CallID ${callID} - Nuevo nombre ${dstFile}`)

        if (dstFile === ' error') {
            parentPort.postMessage({type: 'update', callID: callID, callData: {idEstado: 7} })
            return
        }
        
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

async function login () {
    log.info(`Worker Download Audio ID ${threadId}: Solicitud login a ${IP}`)
    const res = await loginRecorder(IP, username, password)
    return res
    
}

async function checkLogin (response) {
    if (response.hasOwnProperty('authToken')) {
      log.info(`Worker Download Audio ID ${threadId}: Login OK`)
      currentToken = response.authToken
      loginError = null
      return true
    } else if (response.hasOwnProperty('error')) {
      log.error(`Worker Download Audio ID ${threadId}: Validando login Error:  ${response.error}`)
      currentToken = null
      loginError = response.error
      return false
    }
    else {
      log.error(`Worker Download Audio ID ${threadId}: Validando login Error:  ${response.type} ${response.errno}`)
      currentToken = null
      loginError = response.type + ' ' + response.errno
      return false
    }
  }

async function logout () {
    log.info(`Worker Download Audio ID ${threadId}: Loging out ${IP}`)
    const res = await logoutRecorder(IP, currentToken)
    currentToken = null
  }
  
async function keepSession() {

    while(true) {
        await sleep(290000)
        log.info(`Worker Download Audio ID ${threadId}: Enviando keep alive`)
        const res = await keepAlive(IP, currentToken)
        log.info(res)

        if(res.hasOwnProperty('error')) {
            log.error(`Worker Download Audio ID ${threadId}: ${res.error}`)
            logout()
            const r = await login()
            await checkLogin(r)
        }
    }
  
}

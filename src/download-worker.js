'use strict'

const log = require('electron-log')
const sleep = require('./sleep.js')
const { parentPort, workerData, threadId } = require('worker_threads')

let downloadOptions = workerData.options
let token = workerData.options.token

log.info(`Worker Download Audio ID ${threadId}: Creado`)

parentPort.on('message', async (msg) => {
    if (msg.type === 'call') {
        await processCall(msg.callData) 
        parentPort.postMessage({type: 'next'}) 
    } else if (msg.type === 'wait') {
        await sleep(10000)
        parentPort.postMessage({type: 'next'})
    }
})

parentPort.postMessage({type: 'next'})

async function processCall(callData) {
    const { downloadAudio } = require('./recorderEvents.js')
    const IP = downloadOptions.lastRecorderIP
    const callID = callData.callID
    const downloadPath = downloadOptions.downloadPath

    let { ...download } = await downloadAudio(IP, token, callID, downloadPath)

    log.info(`Worker Download Audio ID ${threadId}: Descarga terminada`)
    
    callData = { ...callData, ...download }

    if (download.hasOwnProperty('error')) {
        log.error(`Worker Download Audio ID ${threadId}: CallID ${callData.callID} ${download.error}`)
        // if (download.error == 'The authentication token is invalid.' || download.error == 'RB_RS_NOT_LICENSED') {
        //     return 
        // }
        parentPort.postMessage({
                                type: 'update',
                                callID: callID,
                                callData:
                                        {
                                            idEstado: 6,
                                            respuestaGrabador: download.error
                                        }
                                })
        parentPort.postMessage({type: 'next'})
        return
    } else {
        //Estado: descargado
        callData.idEstado = 3
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

    if (callData.idEstado === 3) {
        const dstFile = createNewFileName(callData, outputFormat)
        log.info(`PostDownloadTasks: CallID ${callID} - Nuevo nombre ${dstFile}`)

        if (downloadOptions.outputFormat != 'wav') {
            log.info(`PostDownloadTasks: CallID ${callID} - Solicitud transcoding.`)
            callData.idEstado = 4
            await convert(ruta, outputFormat, dstFile, overwrite)
                        .then(() => {
                            ruta = callData.ruta = dstFile
                            callData.idEstado = 5
                        })
                        .catch(() => {
                            log.error(`PostDownloadTasks: CallID ${callID} Promise rejected`)
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

    log.info(`PostDownloadTasks: CallID ${callID} - Solicitando actualizacion en BD.`)
    parentPort.postMessage({type: 'update', callID: callID, callData })
}

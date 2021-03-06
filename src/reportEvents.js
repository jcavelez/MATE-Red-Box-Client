const fs = require('fs')
const path = require('path')
const zeroFill = require('./assets/lib/zeroFill.js')

const log = require('electron-log')
log.transports.file.level = 'error'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'

function createNewFileName (callData, downloadOptions) {
    try {
        //console.log(downloadOptions)
        let date = callData.StartDateTime.split(' ')[0].split('/')
        let hour = callData.StartDateTime.split(' ')[1].replaceAll(' ', '_').replaceAll(':', '-')
        hour = hour + '-' + callData.StartDateTime.split(' ')[2]
        let newName =  downloadOptions.callIDField === 'yes' ? callData.callID  : ''
        newName +=  downloadOptions.extensionField === 'yes' ? '_' + callData.Extension : ''
        newName += downloadOptions.channelNameField === 'yes' ? '_' + callData.ChannelName : ''
        newName += downloadOptions.startDateField === 'yes' ? '_' + date[0] + '-' + date[1] + '-' + date[2] + '_' + hour : ''
        newName += downloadOptions.otherPartyField === 'yes' ? '_' + callData.OtherParty : ''
        newName += downloadOptions.agentGroupField === 'yes' ? '_' + callData.AgentGroup : ''
        newName += downloadOptions.externalCallIDField === 'yes' ? '_' + callData.ExternalCallID : ''
        console.log(newName)

        const dir = path.dirname(callData.ruta)
        const subdir = subfolderName(callData)
        const newDir = path.join(dir, subdir)
        makeSubdir(newDir)
        const dstFile = path.join(newDir, `${newName}.${downloadOptions.outputFormat}`)

        return dstFile

    } catch(e) {
        log.error(`Report Event: Creando nuevo nombre - ${e}`)
        return 'error'
    }
}

function subfolderName(callData) {
    let subdirForFile = []
    //subdirForFile.push(callData.AgentGroup? callData.AgentGroup : 'NO_GROUP')
    let date = callData.StartDateTime.split(' ')[0].split('/')
    subdirForFile.push(date[2])
    subdirForFile.push(zeroFill(date[1], 2))
    subdirForFile.push(zeroFill(date[0], 2))
    subdirForFile.push(callData.Extension)

    return subdirForFile.join('\\')
}

function makeSubdir(newDir) {
    fs.mkdirSync(newDir, { recursive: true}, (err) => {
        log.error('File System: ' + err)
    })
}

function createReport (filePath, startDateTime, headers) {
    log.info('Report: ' + filePath)
    filePath = path.normalize(filePath)
    filePath = filePath.split('\\')
    
    //const groupPosition = filePath.findIndex(element => element === group)
    let reportFolder = filePath.slice(0, -2).join('\\')
    let date = startDateTime.split(' ')[0].split('/')
    let reportName = date[0] + '-' + date[1] + '-' + date[2] + '.csv'
    const reportPath = path.join(reportFolder, reportName)

    const creation = new Promise((resolve, reject) => {
        fs.access(reportPath, fs.constants.F_OK, (err) => {
            log.info(`File System: ${reportPath} ${err ? 'no existe' : 'existe'}`)
            if (err) {
                fs.writeFile(reportPath, headers, (error) => {
                    if (error) {
                        log.error(`File System: ${error}`)
                        return error
                    }
                log.info(`File System: Archivo de reporte creado ${reportPath}`)
                })
            }
            resolve(reportPath)
            })
    })

    return creation
}

function saveReport(file, data) {
    try {
        fs.access(file, fs.constants.F_OK, (err) => {
            log.info(`File System: ${file} ${err ? 'sin acceso' : 'accedido'}`)
            if (!err) {
                fs.appendFileSync(file, data, (e) => {
                    if (e) {
                        log.error(`File System: Error abriendo archivo ${err}`)
                    } else {
                        log.info(`File System: Archivo correctamente ${file}`)
                    }
                })
            }
        })
    } catch (exception) {
        log.error(`File System: ${exception}`)
    }
}



module.exports = { createNewFileName, createReport, saveReport }
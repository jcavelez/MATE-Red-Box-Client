const fs = require('fs')

const log = require('electron-log')
log.transports.file.level = 'info'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'

function createErrorLog (filePath) {
    log.info('Download Error Log: Creando archivo')

    const headers = 'callID,'
                    + 'Status,'
                    + 'StatusText,'
                    + 'Error,'
                    + 'StartDateTime,' 
                    + 'EndDateTime,' 
                    + 'Duration,' 
                    + 'Direction,' 
                    + 'Extension,' 
                    + 'ChannelName,' 
                    + 'OtherParty,' 
                    + 'AgentGroup,' 
                    + 'RBRCallGUID,' 
                    + 'ExternalCallID'
                    + '\n'

    const creation = new Promise((resolve, reject) => {
        fs.access(filePath, fs.constants.F_OK, (err) => {
            log.info(`File System: ${filePath} ${err ? 'no existe' : 'existe'}`)
            if (err) {
                fs.writeFile(filePath, headers, (error) => {
                    if (error) {
                        log.error(`File System: ${error}`)
                        return error
                    }
                log.info(`File System: Archivo de reporte creado ${filePath}`)
                })
            }
            resolve(filePath)
            })
    })

    return creation
}


module.exports = { createErrorLog }
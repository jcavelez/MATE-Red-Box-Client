const { app, dialog } = require('electron')
const { forceStopProcess } = require('./download-cycle')
const sleep = require('./sleep')

const log = require('electron-log')
log.transports.file.level = 'error'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'


function relaunchApp (win) {
    const options = {
        message: 'Ocurrió un error inesperado y la aplicación se reiniciará. ',
        type: 'error',
        //buttons: ['Entendido'],
        defaultId: 0,
        title: 'Error'
    }

    dialog.showMessageBoxSync(win, options)
    log.error(`Main: Reiniciando aplicación.`)
    app.relaunch()
    app.exit(0)
}

function handleUnresponsive(win) {
    log.error(`Main: WebContents unresponsive event emitted.`)
    const options = {
        message: 'La aplicación no responde. puede esperar o reiniciar la aplicación manualmente',
        type: 'warning',
        buttons: ['Esperar', 'Reiniciar'],
        defaultId: 0,
        title: 'MATE'
    }

    const resp = dialog.showMessageBoxSync(win, options)

    if (resp === 1) relaunchApp(win)
}

async function handleUncaughtException(win, err) {

    log.error(`Main: Process uncaughtException event emitted - Error: ${err}`)
    
    const options = {
        message: 'Ocurrió un error inesperado. Informe al administrador del sistema e inicie su búsqueda nuevamente.',
        type: 'error',
        //buttons: ['Entendido'],
        defaultId: 0,
        title: 'Error'
    }
    
    forceStopProcess()

    dialog.showMessageBoxSync(win, options)

    app.relaunch()
    app.exit(0)
}


function setupErrors(win) {

    // Emitted when the renderer process unexpectedly disappears.
    //This is normally because it was crashed or killed.
    win.webContents.on('render-process-gone', (e, details) => {
        log.error(`Main: WebContents render-process-gone event emitted - Reason: ${details.reason}. ExitCode: ${details.exitCode}.`)
        relaunchApp(win)
    })

    win.webContents.on('unresponsive', () => { handleUnresponsive(win)
    })

    win.on('unresponsive', () => { handleUnresponsive(win)
    })

    process.on('uncaughtException', (err) => handleUncaughtException(win, err))

}

module.exports = { setupErrors }
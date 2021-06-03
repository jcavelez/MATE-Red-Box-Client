function loadPreferences() {
    window.api.send('loadPreferences')
}

function openDir() {
    window.api.send('openDir')
    console.log('enviado')
}

function requestStartDownload(options) {
    console.log('enviando senal descarga descarga')

    // let downloadOptions = {
    //     resultsToSkip: 0,
    //     searchMode: 'EarlierFirst',
    //     startTime: '20210521080000',
    //     endTime: '20210521235959',
    //     extension:'',
    //     channelName: '',
    //     outputFormat: 'wav',
    //     downloadPath: document.getElementById('download-section-input').value
    // }
    window.api.send('startDownload', options) 
}

function openExportPreferences(event) {
    console.log('abrir ventana de opciones de descarga')
    //closing dialog
    const dialog = document.getElementById('menu-dialog')
    window.api.send('openExportOptions')
    dialog.removeAttribute('open')
}

window.api.receive('recievePath', (data) => {
    document.getElementById('download-section-input').value = data
})

window.api.receive('getPreferences', (prefs) => {

    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    replaceText('username', `[${prefs.username}]`)
    replaceText('recorder', prefs.lastRecorderIP)

    document.getElementById('download-section-input').value = prefs.downloadDirectory
    document.getElementById('start-date').value = `${prefs.startTime.substring(6,8)}/${prefs.startTime.substring(4,6)}/${prefs.startTime.substring(0,4)}`
    document.getElementById('start-time').value = `${prefs.startTime.substring(10,12)}:${prefs.startTime.substring(8,10)}`
})

window.api.receive('queryFinished', () => {
    console.log('queryfinished')
    const notification = document.getElementById("notification")
    notification.innerText = 'Descarga terminada'
    notification.opened = true
})

export { openDir, loadPreferences, requestStartDownload, openExportPreferences } 
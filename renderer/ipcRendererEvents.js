//import { ipcRenderer } from 'electron'
//const { ipcRenderer } = require("electron")
//const electron = window.require('electron')
//const ipcRenderer = electron.ipcRenderer

function openDir() {
    window.api.send('openDir')
    console.log('enviado')
}

function requestStartDownload() {
    console.log('enviando senal descarga descarga')
    let downloadOptions = {
        resultsToSkip: 0,
        searchMode: "LatestFirst",
        startTime: '20210518000000',
        endTime: '20210518085959',
        extension:'',
        channelName: '',
        outputFormat: '.wav',
        downloadPath: document.getElementById('download-section-input').value
    }
    window.api.send('startDownload', downloadOptions) 
}

window.api.receive('recievePath', (data) => {
    document.getElementById('download-section-input').value = data
})

export { openDir, requestStartDownload } 
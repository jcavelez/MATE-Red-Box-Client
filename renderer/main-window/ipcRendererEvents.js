function openDir() {
    window.api.send('openDir')
    console.log('enviado')
}

function requestStartDownload() {
    console.log('enviando senal descarga descarga')
    let downloadOptions = {
        resultsToSkip: 0,
        searchMode: "LatestFirst",
        startTime: '20210521080000',
        endTime: '20210521235959',
        extension:'',
        channelName: '',
        outputFormat: '.wav',
        downloadPath: document.getElementById('download-section-input').value
    }
    window.api.send('startDownload', downloadOptions) 
}

function openSearchPreferences() {
    console.log('abrir ventana de opciones de descarga')
    window.api.send('openExportOptions')
}

// window.api.receive('recievePath', (data) => {
//     document.getElementById('download-section-input').value = data
// })

export { openDir, requestStartDownload, openSearchPreferences } 
const { app, contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'api', {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = ['toMain', 'login', 'openMainWindow', 'loadPreferences','openDir', 'startDownload', 'stop', 'openExportOptions'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = ['fromMain', 'recievePath', 'loadLastLogin', 'loginAlert', 'searchError', 'newToken', 'recorderSearching', 'recorderDownloading',  'recorderLoginError', 'finishing' ,'queryFinished', 'queryInterrupted', 'getPreferences', 'downloadResponse', 'recorderNotLicensed'];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                ipcRenderer.on(channel, (event, ...args) => func(...args))
            }
        }
    }
)

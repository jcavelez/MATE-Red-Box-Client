const { app, contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'api', {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = ['toMain', 'loadPreferences','openDir', 'startDownload', 'openExportOptions'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = ['fromMain', 'recievePath', 'getPreferences'];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                ipcRenderer.on(channel, (event, ...args) => func(...args))
            }
        }
    }
)

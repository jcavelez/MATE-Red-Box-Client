const { app, contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'api', {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = ['toMain', 'login', 'openMainWindow',  'updatePreferences', 'openDir', 'startDownload', 'stop', 'openUserOptions', 'openExportOptions', 'setDebuggingLevel', 'modalStatus'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },

        receive: (channel, func) => {
            let validChannels = ['fromMain', 'recievePath', 'loginAlert', 'searchError', 'newToken', 'searchUpdate' , 'recorderSearching', 'recorderDownloading',  'recorderLoginError', 'finishing' ,'queryFinished', 'queryInterrupted', 'getPreferences', 'downloadResponse', 'recorderNotLicensed', 'userOptionsWindowClosed','exportsWindowClosed'];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                ipcRenderer.on(channel, (event, ...args) => func(...args))
            }
        },

        invoke: async (channel, data) => ipcRenderer.invoke(channel, data),
    }
)

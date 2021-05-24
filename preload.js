const { app, contextBridge, ipcRenderer } = require('electron');
const settings = require('electron-settings')


// contextBridge.exposeInMainWorld(
//     'api', {
//         send: (channel, data) => {
//             // whitelist channels
//             let validChannels = ['toMain', 'openDir', 'startDownload', 'openExportOptions'];
//             if (validChannels.includes(channel)) {
//                 ipcRenderer.send(channel, data);
//             }
//         },
//         receive: (channel, func) => {
//             let validChannels = ['fromMain', 'recievePath'];
//             if (validChannels.includes(channel)) {
//                 // Deliberately strip event as it includes `sender` 
//                 ipcRenderer.on(channel, (event, ...args) => func(...args))
//             }
//         }
//     }
// )

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded')
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    settings.setSync('username', 'admin')
    settings.setSync('password', 'recorder')
    settings.setSync('lastRecorderIP', '172.20.47.11')

    replaceText('username', `[${settings.getSync('username')}]`)
    replaceText('recorder', settings.getSync('lastRecorderIP'))

  })

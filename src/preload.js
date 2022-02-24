const { app, contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'api', {
        //send: communication from render to main
        send: (channel, data) => ipcRenderer.send(channel, data),
        //recieve: communication from main to render
        receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
        //invoke: async two ways communication between render and main. IPC Main uses handle function
        invoke: async (channel, data) => ipcRenderer.invoke(channel, data),
    }
)

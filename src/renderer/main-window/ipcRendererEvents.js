import { validateDate } from '../../assets/lib/validateDate.js'
import { formatStartDate, formatEndDate } from '../../assets/lib/formatDate.js'

let currentToken

let options = {}


function loadPreferences() {
    window.api.send('loadPreferences')
}

function openDir() {
    window.api.send('openDir')
}

function openStatusDialog(ev) {
    const startDateInput = document.getElementById('start-date')
    const startHourInput = document.getElementById('start-hour')
    const endDateInput = document.getElementById('end-date')
    const endHourInput = document.getElementById('end-hour')

    const validatePath = () =>{

        let isValidPath = false
    
        const validatePathRegEx = new RegExp('^[a-z]:(\/|\\\\)([a-zA-Z0-9_ \-]+\\1)*[a-zA-Z0-9_ @\-]+\.$', 'i')
        const directory = document.getElementById('download-section-input').value
    
        const validPath = validatePathRegEx.test(directory)
    
        if (validPath) {
            options.downloadPath = directory
            isValidPath = true
        } else {
            notify('"Ruta inválida". Por favor verifique la carpeta de descarga sea una ruta válida.')
            const modal = document.getElementById("download-dialog")
            modal.close()
        }
    
        return isValidPath
    }
    
    const getSearchFields =() => {
        options.startTime = formatStartDate(startDateInput.value, startHourInput.value)
        options.endTime = formatEndDate(endDateInput.value, endHourInput.value)
    }
    
    const checkDates = () => {
        let startDate = document.getElementById('start-date').value
        let endDate = document.getElementById('end-date').value
    
        if (validateDate(startDate) && validateDate(endDate)) {
            if(formatEndDate(endDateInput.value, endHourInput.value) < formatStartDate(startDateInput.value, startHourInput.value)){
                notify('La fecha final debe ser mayor que la fecha inicial')
                return false
            }
    
            return true
        } else {
            notify('La fecha que ingreso no es válida ')
            return false
        }
    }
    
    const validateForm = () => {
        let isValidPath = validatePath()
        let isValidDate = checkDates()
        
        return (isValidPath && isValidDate) 
    }


    ev.target.removeEventListener('click', openStatusDialog)
    const valid = validateForm()
    if (valid) {
        console.log(valid)
        getSearchFields()
        requestStartDownload(options)
    }
}

function requestStartDownload(options) {
    const gif = document.getElementById("gif")
    const m1 = document.getElementById("messages-big")
    const m2 = document.getElementById("messages-small")
    gif.src = "../assets/img/cargando.gif"
    m1.innerHTML = 'Estableciendo comunicación con el servidor'
    m2.innerHTML = 'Por favor espere'
    
    console.log('request download, sending to ipc main')
    window.api.send('startDownload', options) 
}

function openExportPreferences(event) {
    window.api.send('openExportOptions')
    //closing dialog
    const dialog = document.getElementById('menu-dialog')
    dialog.removeAttribute('open')
}

function stopDownloadProccess() {
    window.api.send('stop', currentToken)
}



function notify (message) {
    const notification = document.getElementById("notification");
    notification.innerText = message
    notification.opened = true
}

//************************************************* */
//*******************EVENTOS ********************** */
//************************************************* */

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
    document.getElementById('start-date').value = prefs.startTime.substring(6,8) + 
                                                '/'+ 
                                                prefs.startTime.substring(4,6) +
                                                '/' +
                                                prefs.startTime.substring(0,4) 
    document.getElementById('start-hour').value = prefs.startTime.substring(8,10)
                                                + ':' + 
                                                prefs.startTime.substring(10,12)
    document.getElementById('end-date').value = prefs.endTime.substring(6,8) +
                                                '/' + 
                                                prefs.endTime.substring(4,6) +
                                                '/' +
                                                prefs.endTime.substring(0,4)
    document.getElementById('end-hour').value = prefs.endTime.substring(8,10)
                                                + ':' + 
                                                prefs.endTime.substring(10,12)
})

window.api.receive('newToken', (token) => currentToken = token)

window.api.receive('recorderSearching', () => {
    console.log('Buscando')
    const gif = document.getElementById("gif")
    const m1 = document.getElementById("messages-big")
    const m2 = document.getElementById("messages-small")
    gif.src = "../assets/img/search.gif"
    m1.innerHTML = 'Ejecutando búsqueda'
    m2.innerHTML = 'Por favor espere'
})

window.api.receive('recorderDownloading', () => {
    console.log('Recorder connected')
    const gif = document.getElementById("gif")
    const m1 = document.getElementById("messages-big")
    const m2 = document.getElementById("messages-small")
    gif.src = "../assets/img/downloading.gif"
    m1.innerHTML = 'Descarga de audios en curso'
    m2.innerHTML = 'Por favor espere'
})

window.api.receive('recorderLoginError', (error) => {
    console.log('Recorder error')
    const gif = document.getElementById("gif")
    const m1 = document.getElementById("messages-big")
    const m2 = document.getElementById("messages-small")
    const btn = document.getElementById("stop-btn")
    gif.src = "../assets/img/error-connection.png"
    m1.innerHTML = 'Error de comunicación con el grabador'
    m2.innerHTML = error
    btn.innerHTML = 'Cerrar'

})

window.api.receive('queryFinished', () => {
    console.log('queryfinished')
    const notification = document.getElementById("notification")
    const modal = document.getElementById("download-dialog");
    modal.close()
    notification.innerText = 'Descarga terminada'
    notification.opened = true
    document.getElementById('download-button').addEventListener('click', openStatusDialog)
})

export { openDir, loadPreferences, requestStartDownload, stopDownloadProccess, openExportPreferences, openStatusDialog } 
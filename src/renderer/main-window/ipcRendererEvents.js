import { validateDate } from '../../assets/lib/validateDate.js'
import { formatStartDate, formatEndDate } from '../../assets/lib/formatDate.js'
import { enableChildren } from './frontend.js'

let options = {}

async function loadCurrentLogin() {
    const currentLogin = await window.api.invoke('loadLastLogin')
    console.log(currentLogin)

    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }
    
    replaceText('username', `[${currentLogin.username}]`)
    replaceText('recorder', currentLogin.lastRecorderIP)
}

async function loadLastSearch() {
    const lastSearch = await window.api.invoke('loadLastSearch')
    console.log(lastSearch)

    if(lastSearch.downloadDirectory) {
        document.getElementById('download-section-input').value = lastSearch.downloadDirectory
    }

    if (lastSearch.startTime) {
        document.getElementById('start-date').value = lastSearch.startTime.substring(6,8) + 
                                                    '/'+ 
                                                    lastSearch.startTime.substring(4,6) +
                                                    '/' +
                                                    lastSearch.startTime.substring(0,4) 
        document.getElementById('start-hour').value = lastSearch.startTime.substring(8,10)
                                                    + ':' + 
                                                    lastSearch.startTime.substring(10,12)
    }

    if (lastSearch.endTime) {
        document.getElementById('end-date').value = lastSearch.endTime.substring(6,8) +
        '/' + 
                                                    lastSearch.endTime.substring(4,6) +
                                                    '/' +
                                                    lastSearch.endTime.substring(0,4)
        document.getElementById('end-hour').value = lastSearch.endTime.substring(8,10)
                                                    + ':' + 
                                                    lastSearch.endTime.substring(10,12)
    }

    if(lastSearch.Extension) {
        document.getElementById('switch-extension').toggled = true
        enableChildren(document.getElementById('card-extension'))
        document.getElementById('input-extension').value = lastSearch.Extension
    }

    if(lastSearch.AgentGroup) {
        document.getElementById('switch-group').toggled = true
        enableChildren(document.getElementById('card-group'))
        document.getElementById('input-group').value = lastSearch.AgentGroup
    }
}

function openDir() {
    window.api.send('openDir')
}

function openStatusDialog(ev) {
    options = {}
    const startDateInput = document.getElementById('start-date')
    const startHourInput = document.getElementById('start-hour')
    const endDateInput = document.getElementById('end-date')
    const endHourInput = document.getElementById('end-hour')
    const groupInput = document.getElementById('input-group')
    const groupSwitch = document.getElementById('switch-group')
    const extensionInput = document.getElementById('input-extension')
    const extensionSwitch = document.getElementById('switch-extension')

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
        
        console.log('extensionSwitch.toggled ' + extensionSwitch.toggled)
        if (extensionSwitch.toggled && extensionInput.value.trim() != '') {
            let extensions = extensionInput.value.split(',')
            extensions = extensions.map(ext => ext.trim())
            options.extension = extensions.filter(ext => ext != '')
            console.log(options.extension)
        }

        if (groupSwitch.toggled && groupInput.value.trim() != '') {
            let groups = groupInput.value.split(',')
            groups = groups.map(gr => gr.trim())
            options.group = groups.filter(gr => gr != '')
            console.log(options.group)
        }
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
            notify('La fecha que ingresó no es válida')
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
        getSearchFields()
        console.log(options)
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
    console.log('enviando busqueda')
    console.log(options)
    window.api.send('modalStatus', true)
}

function openUserOptions() {
    window.api.send('openUserOptions')
    const dialog = document.getElementById('menu-dialog')
    dialog.close()
    on() //overlay
}

function openExportPreferences() {
    window.api.send('openExportOptions')
    const dialog = document.getElementById('menu-dialog')
    dialog.close()
    on() //overlay
}

function stopDownloadProccess() {
    window.api.send('stop')
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


window.api.receive('recorderSearching', () => {
    console.log('Buscando')
    const gif = document.getElementById("gif")
    const m1 = document.getElementById("messages-big")
    const m2 = document.getElementById("messages-small")
    const continueBtn = document.getElementById('continue-btn')
    gif.src = "../assets/img/search.gif"
    m1.innerHTML = 'Ejecutando búsqueda'
    m2.innerHTML = 'Por favor espere'
    continueBtn.style.display = 'none'
    window.api.send('modalStatus', true)
})

window.api.receive('recorderDownloading', () => {
    console.log('Recorder connected')
    const gif = document.getElementById("gif")
    const m1 = document.getElementById("messages-big")
    const m2 = document.getElementById("messages-small")
    gif.src = "../assets/img/downloading.gif"
    m1.innerHTML = 'Descarga de Audios en Curso'
    m2.innerHTML = 'por favor espere'
    window.api.send('modalStatus', true)
})

window.api.receive('recorderLoginError', (error) => {
    console.log('Recorder error')
    const gif = document.getElementById("gif")
    const m1 = document.getElementById("messages-big")
    const m2 = document.getElementById("messages-small")
    const btn = document.getElementById("stop-btn")
    gif.src = "../assets/img/error-connection.png"
    m1.innerHTML = 'Error de Comunicación con el Grabador'
    m2.innerHTML = error
    btn.innerHTML = 'Cerrar'
    window.api.send('modalStatus', true)
})

window.api.receive('finishing', () => {
    console.log('finishing')
    const gif = document.getElementById("gif")
    const m1 = document.getElementById("messages-big")
    const m2 = document.getElementById("messages-small")
    gif.src = "../assets/img/finishing.png"
    m1.innerHTML = 'Finalizando Descarga'
    m2.innerHTML = 'Terminando procesos pendientes'
    window.api.send('modalStatus', true)

})

window.api.receive('queryFinished', (data) => {
    console.log('queryfinished')
    const notification = document.getElementById("notification")
    const modal = document.getElementById("download-dialog")
    console.log(modal.open)
    modal.close()
    notification.innerText =    `Descarga Terminada. Descargas exitosas: ${data.successes}. Errores: ${data.failures}. Pendientes: ${data.partials}`
    notification.opened = true
    document.getElementById('download-button').addEventListener('click', openStatusDialog)
    window.api.send('modalStatus', false)
})

window.api.receive('searchError', (msg) => {
    console.log('searchError')
    const notification = document.getElementById("notification")
    const modal = document.getElementById("download-dialog");
    modal.close()
    notification.innerText = 'Error ejecutando busqueda: ' + msg.error
    notification.opened = true
    document.getElementById('download-button').addEventListener('click', openStatusDialog)
    window.api.send('modalStatus', false)
})

window.api.receive('queryInterrupted', (data) => {
    console.log('queryInterrupted')
    const notification = document.getElementById("notification")
    const modal = document.getElementById("download-dialog");
    modal.close()
    notification.innerText =    `Descarga Interrumpida. Descargas: ${data.successes}. Errores: ${data.failures}.  Pendientes: ${data.partials}`
    notification.opened = true
    document.getElementById('download-button').addEventListener('click', openStatusDialog)
    window.api.send('modalStatus', false)
})

window.api.receive('recorderNotLicensed', () => {
    console.log('recorderNotLicensed')
    const gif = document.getElementById("gif")
    const m1 = document.getElementById("messages-big")
    const m2 = document.getElementById("messages-small")
    const continueBtn = document.getElementById('continue-btn')
    gif.src = "../assets/img/warning.svg"
    m1.innerHTML = 'Cerrando Proceso'
    m2.innerHTML = 'No hay suficientes licencias para continuar la descarga'
    continueBtn.style.display = 'flex'
    continueBtn.addEventListener('click' , () => {
        gif.src = "../assets/img/downloading.gif"
        m1.innerHTML = 'Descarga de Audios en Curso'
        m2.innerHTML = 'por favor espere'
        continueBtn.style.display = 'none'
        window.api.send('modalStatus', true)
    })
})

window.api.receive('searchUpdate', (data) => {
    console.log(data)
    const m2 = document.getElementById("messages-small")
    m2.innerHTML = `Descargas: ${data.successes} - Total: ${data.total} `
})

window.api.receive('userOptionsWindowClosed', off)
window.api.receive('exportsWindowClosed', off)


export { openDir, loadLastSearch, loadCurrentLogin, requestStartDownload, stopDownloadProccess, openUserOptions, openExportPreferences, openStatusDialog } 


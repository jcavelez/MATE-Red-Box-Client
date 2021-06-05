import { loadPreferences, openDir, requestStartDownload, openExportPreferences } from './ipcRendererEvents.js'


const openDirectoryBtn = document.getElementById('open-directory')
const downloadBtn = document.getElementById('download-button')
const exportSettingsBtn = document.getElementById('export-settings-btn')
const exitBtn = document.getElementById('exit-button')
const notification = document.getElementById("notification");

const switchEndDate = document.getElementById("switch-end-date")
const switchExtension = document.getElementById("switch-extension")
const switchChannelName = document.getElementById("switch-channel-name")

const startDateInput = document.getElementById('start-date')


window.addEventListener('load', addEvents)
window.addEventListener('load', loadPreferences)

function addEvents() {
    startDateInput.addEventListener('click', (ev) => {
        ev['target'].value = ''
    })
    switchEndDate.addEventListener('toggle', toggleBox)
    switchChannelName.addEventListener('toggle', toggleBox)
    switchExtension.addEventListener('toggle', toggleBox)
    openDirectoryBtn.addEventListener('click', openDir)
    exportSettingsBtn.addEventListener('click', openExportPreferences)
    downloadBtn.addEventListener('click', validateForm)
    exitBtn.addEventListener('click', exit)
}

function toggleBox(ev) {
    const box = ev["target"].parentElement.parentElement
    if (ev.target.toggled) {
        enableChildren(box)
    } else {
        disableChildren(box)
    }
}

function enableChildren(node) {
    const children = [...node.children]
    if (children) {
        children.forEach(element => {
            if(element.tagName != 'X-SWITCH') {
                enableChildren(element)
            }
     
        })
    }
    node.removeAttribute("disabled")
}

function disableChildren(node) {
    const children = [...node.children]
    if (children) {
        children.forEach(element => {
            if (element.tagName != 'X-SWITCH' ) {
                this.disableChildren(element)
            }
        })
    }
    
    node.setAttribute("disabled","") 
}

function validateForm() {
    const notify = (message) => {
        notification.innerText = message
        notification.opened = true
    }

    const validateDate = (d) => {
        const s = d.split('/')
        
        return (s.length === 3 && s[0] <= 31 && s[1] <= 12 && s[2] < 3000 && s[2] > 1000) ? true : false
    }

    const formatDate = (date, hour='') => {
        const s = date.split('/')
        const t = hour.split(':')
        console.log(t[0]?t[0]:'00')
        console.log(t[1]?t[1]:'00')

        return  `${s[2]}${s[1]}${s[0]}${t[0]?t[0]:'00'}${t[1]?t[1]:'00'}00`
    }

    let options = {}
    let isValid = false

    const validatePath = new RegExp('^[a-z]:(\/|\\\\)([a-zA-Z0-9_ \-]+\\1)*[a-zA-Z0-9_ @\-]+\.$', 'i')
     const directory = document.getElementById('download-section-input').value

    const validPath = validatePath.test(directory)

    if (validPath) {
        options.downloadPath = directory
        isValid = true
    } else {
        notify('"Ruta inválida". Por favor verifique la carpeta de descarga sea una ruta válida.')
    }

    //getting start date
    let date = document.getElementById('start-date').value
    let time = document.getElementById('start-time').value

    let validDate = validateDate(date)

    if (validDate) {
        console.log('valid date')
        options.startTime = formatDate(date, time)
        console.log(`fecha formateada ${options.startTime}`)
    }
    else {
        notify('Fecha de inicio inválida')
        isValid = false
    }
    
    if (isValid) {
        requestStartDownload(options)
    }
}

function exit() {
    window.close()
}
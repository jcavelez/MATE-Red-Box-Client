import { loadPreferences, openDir, requestStartDownload, openExportPreferences, openStatusDialog, stopDownloadProccess } from './ipcRendererEvents.js'
import { validateDate } from '../../assets/lib/validateDate.js'


const openDirectoryBtn = document.getElementById('open-directory')
const downloadBtn = document.getElementById('download-button')
const exportSettingsBtn = document.getElementById('export-settings-btn')
const exitBtn = document.getElementById('exit-button')
const notification = document.getElementById("notification");

const switchEndDate = document.getElementById("switch-end-date")
const switchExtension = document.getElementById("switch-extension")
const switchGroup = document.getElementById("switch-group")

const startDateInput = document.getElementById('start-date')
const startHourInput = document.getElementById('start-hour')
const errorStartDate = document.getElementById("start-date-error")
const errorEndDate = document.getElementById("end-date-error")
const endDateInput = document.getElementById('end-date')
const endHourInput = document.getElementById('end-hour')

const stopButton = document.getElementById('stop-btn')
const downloadModal = document.getElementById("download-dialog");

window.addEventListener('load', addEvents)
window.addEventListener('load', loadPreferences)

function addEvents() {
    const clear =  (ev) => {
        ev['target'].value = ''
    }

    switchGroup.addEventListener('toggle', toggleBox)
    switchExtension.addEventListener('toggle', toggleBox)
    switchEndDate.addEventListener('toggle', toggleBox)

    startDateInput.addEventListener('click', clear)
    startHourInput.addEventListener('click', clear)
    endDateInput.addEventListener('click', clear)
    endHourInput.addEventListener('click', clear)
    openDirectoryBtn.addEventListener('click', openDir)
    exportSettingsBtn.addEventListener('click', openExportPreferences)
    downloadBtn.addEventListener('click', openStatusDialog)
    exitBtn.addEventListener('click', exit)
    //Valida fecha al perder el foco
    startDateInput.addEventListener('blur', (ev) => { 
        validateDate(ev.target.value) ? errorStartDate.innerText = '' : errorStartDate.innerText = 'Fecha invalida'
    })
    endDateInput.addEventListener('blur', (ev) => { validateDateInput(ev, errorEndDate)})

    stopButton.addEventListener('click', stopDownload)
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

function validateDateInput (evt, error) {
    let text = evt.target.value
    
    let resultado = validateDate(text);

    if (resultado) {
        error.innerText = ''
    } else {
        error.innerText = "Fecha incorrecta";
    }
}

function notify (message) {
    notification.innerText = message
    notification.opened = true
}




function exit() {
    window.close()
}

function stopDownload() {
    downloadModal.close()
    stopDownloadProccess()
    //downloadBtn.addEventListener('click', openStatusDialog)
}

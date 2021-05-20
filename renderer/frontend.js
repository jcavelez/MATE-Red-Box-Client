import { openDir, requestStartDownload } from './ipcRendererEvents.js'

const openDirectoryBtn = document.getElementById('open-directory')
const downloadBtn = document.getElementById('download-button')
const exitBtn = document.getElementById('exit-button')

const switchEndDate = document.getElementById("switch-end-date")
const switchExtension = document.getElementById("switch-extension")
const switchChannelName = document.getElementById("switch-channel-name")


window.addEventListener('load', addEvents)
document.getElementById('download-section-input').value = 'C:\\Users\\jcave\\OneDrive\\Escritorio\\Descargas-Red-Box'

function addEvents() {
    switchEndDate.addEventListener('toggle', toggleBox)
    switchChannelName.addEventListener('toggle', toggleBox)
    switchExtension.addEventListener('toggle', toggleBox)
    openDirectoryBtn.addEventListener('click', openDir)
    exitBtn.addEventListener('click', exit)
    downloadBtn.addEventListener('click', requestStartDownload)
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

function exit() {
    window.close()
}
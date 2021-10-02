const saveBtn = document.getElementById('save')
const exitBtn = document.getElementById('exit')
const formatMenu = document.getElementById('format-menu').firstElementChild
const overwriteMenu = document.getElementById('overwrite-menu').firstElementChild
const reportMenu = document.getElementById('report-menu').firstElementChild
const callIdCheck = document.getElementById('filename-callId')
const externalCallIdCheck = document.getElementById('filename-externalCallId')
const startDateCheck = document.getElementById('filename-startDate')
const endDateCheck = document.getElementById('filename-endDate')
const extensionCheck = document.getElementById('filename-extension')
const channelNameCheck = document.getElementById('filename-channelName')
const otherPartyCheck = document.getElementById('filename-otherParty')
const agentGroupCheck = document.getElementById('filename-agentGroup')


const allowedFormats = ['wav', 'mp3']

for (const format of allowedFormats) {
    let newItem = document.createElement('x-menuitem')
    newItem.appendChild(document.createElement('x-label'))
    newItem.firstElementChild.innerHTML = format.toUpperCase()
    newItem.setAttribute('value', 
    format)
    formatMenu.appendChild(newItem)
}

saveBtn.addEventListener('click', savePreferences)
exitBtn.addEventListener('click', closeWindow)

window.addEventListener('load', () => {
    loadExportPreferences()
})



function getSelected(menu) {
    for (const menuItem of menu.children) {
        if(menuItem.hasAttribute('toggled')) {
            return menuItem.value
        }
    }
}

//TODO: FALTAN VALIDACIONES
function savePreferences() {
    
    const prefs = {
        outputFormat: getSelected(formatMenu),
        overwrite: getSelected(overwriteMenu),
        report: getSelected(reportMenu),
        callIDField: callIdCheck.hasAttribute('toggled') ? 'yes' : 'no',
        externalCallIDField: externalCallIdCheck.hasAttribute('toggled') ? 'yes' : 'no',
        startDateField: startDateCheck.hasAttribute('toggled') ? 'yes' : 'no',
        endDateField: endDateCheck.hasAttribute('toggled') ? 'yes' : 'no',
        extensionField: extensionCheck.hasAttribute('toggled') ? 'yes' : 'no',
        channelNameField: channelNameCheck.hasAttribute('toggled') ? 'yes' : 'no',
        otherPartyField: otherPartyCheck.hasAttribute('toggled') ? 'yes' : 'no',
        agentGroupField: agentGroupCheck.hasAttribute('toggled') ? 'yes' : 'no',
    }
    window.api.send('updatePreferences', prefs)
    window.close()
}

function closeWindow(ev) {
    window.close()
}

async function loadExportPreferences() {
    const exportPreferences = await window.api.invoke('loadExportPreferences')
    console.log(exportPreferences)

    //Pongo el formato de salida
    for (let node of formatMenu.children) {
        console.log(node.value)
        if(node.value == exportPreferences.outputFormat) {
           node.setAttribute('toggled', '')
           break
        }
    }

    //pongo la opcion de sobre escribir archivos
    exportPreferences.overwrite === 'yes' ? document.getElementById('overwrite-menu--yes').setAttribute('toggled', '') : document.getElementById('overwrite-menu--no').setAttribute('toggled', '')

    //pongo la opcion de sobre escribir archivos
    exportPreferences.report === 'yes' ? document.getElementById('report-menu--yes').setAttribute('toggled', '') : document.getElementById('report-menu--no').setAttribute('toggled', '')

    //cargando opciones para el nombre del archivo
    exportPreferences.callIDField === 'yes' ? callIdCheck.setAttribute('toggled', '') : callIdCheck.removeAttribute('toggled')

    exportPreferences.externalCallIDField === 'yes' ? externalCallIdCheck.setAttribute('toggled', '') : externalCallIdCheck.removeAttribute('toggled')

    exportPreferences.startDateField === 'yes' ? startDateCheck.setAttribute('toggled', '') : startDateCheck.removeAttribute('toggled')

    exportPreferences.endDateField === 'yes' ? endDateCheck.setAttribute('toggled', '') : endDateCheck.removeAttribute('toggled')

    exportPreferences.extensionField === 'yes' ? extensionCheck.setAttribute('toggled', '') : extensionCheck.removeAttribute('toggled')

    exportPreferences.channelNameField === 'yes' ? channelNameCheck.setAttribute('toggled', '') : channelNameCheck.removeAttribute('toggled')

    exportPreferences.otherPartyField === 'yes' ? otherPartyCheck.setAttribute('toggled', '') : otherPartyCheck.removeAttribute('toggled')

    exportPreferences.agentGroupField === 'yes' ? agentGroupCheck.setAttribute('toggled', '') : agentGroupCheck.removeAttribute('toggled')

    


}



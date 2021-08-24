const saveBtn = document.getElementById('save')
const exitBtn = document.getElementById('exit')
const formatMenu = document.getElementById('format-menu')

saveBtn.addEventListener('click', savePreferences)
exitBtn.addEventListener('click', closeWindow)

const allowedFormats = ['wav', 'mp3']

allowedFormats.forEach((f) => {
    const menuElement = `<x-menuitem value="${f}">
    <x-label>${f.toUpperCase()}</x-label>
    </x-menuitem>`
    formatMenu.innerHTML(menuElement)
})

getExportPreferences()


function savePreferences() {
    console.log(formatMenu.value)
    const prefs = {
        outputFormat: formatMenu.value
    }
    window.api.send('updatePreferences', prefs)
    window.close()
}

function closeWindow(ev) {
    window.close()
}

function getExportPreferences() {
    const lastFormat = await window.api.invoke('getExportPreferences')
}


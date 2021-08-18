const saveBtn = document.getElementById('save')
const exitBtn = document.getElementById('exit')
const formatMenu = document.getElementById('format-menu')

saveBtn.addEventListener('click', savePreferences)
exitBtn.addEventListener('click', closeWindow)

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

function getExportOptions() {
    console.log(formatMenu.value)
}


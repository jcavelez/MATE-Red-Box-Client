const saveBtn = document.getElementById('save')
const exitBtn = document.getElementById('exit')
const formatMenu = document.getElementById('format-menu')

saveBtn.addEventListener('click', closeWindow)
exitBtn.addEventListener('click', closeWindow)

function closeWindow(ev) {
    window.close()
}

function getExportOptions() {
    console.log(formatMenu.value)
}


const saveBtn = document.getElementById('save')
const exitBtn = document.getElementById('exit')

saveBtn.addEventListener('click', closeWindow)
exitBtn.addEventListener('click', closeWindow)

function closeWindow(ev) {
    window.close()
}
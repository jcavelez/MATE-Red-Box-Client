const saveBtn = document.getElementById('save')
const exitBtn = document.getElementById('exit')
const debugMenu = document.getElementById('debugging-menu').firstElementChild

window.addEventListener('load', () => {
    loadUserOptions()
})
saveBtn.addEventListener('click', savePreferences)
exitBtn.addEventListener('click', closeWindow)

async function loadUserOptions() {
    const logLevel = await window.api.invoke('loadLogLevel')
    console.log(logLevel)
    document.getElementById(`debugging-menu--${logLevel.toLowerCase()}`).
        setAttribute('toggled', '')
}

function getSelected(menu) {
    for (const menuItem of menu.children) {
        if(menuItem.hasAttribute('toggled')) {
            return menuItem.value
        }
    }
}

function savePreferences() {
    window.api.send('setDebuggingLevel', {level: getSelected(debugMenu)})
    window.close()
}

function closeWindow() {
    window.close()
}
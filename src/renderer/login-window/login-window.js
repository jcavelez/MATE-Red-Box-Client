const recorderInput = document.getElementById('recorder')
const usernameInput = document.getElementById('username')
const passwordInput = document.getElementById('password')
const rememberCheck = document.getElementById('remember')
const loginBtn = document.getElementById('login')
const notification = document.getElementById('notification')
const modal = document.getElementById('modal-loading')

loginBtn.addEventListener('click', () => {
    modal.classList.add('is-visible')
    recorderInput.blur()
    usernameInput.blur()
    passwordInput.blur()
    modal.focus()
})
loginBtn.addEventListener('click', sendForm)

function sendForm() {
    const loginData = {
        recorder: recorderInput.value,
        username: usernameInput.value,
        password: passwordInput.value,
        saveData: rememberCheck.toggled
    }

    if (validateIPAddress(loginData.recorder)) {
        console.log(`Login Window: Direccion IP Válida`)
        window.api.send('login', loginData)
    }
    else {
        modal.classList.remove('is-visible')
        notification.innerHTML = 'Dirección IP inválida'
        notification.opened = true
    }
}


function validateIPAddress(inputText) {
    const IPValidator = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

    return inputText.match(IPValidator)
}

window.api.receive('loadLastLogin', (loginData) => {
    recorderInput.value = loginData.recorder
    usernameInput.value = loginData.username
    passwordInput.value = loginData.password
})

window.api.receive('loginAlert', (msg) => {
    modal.classList.remove('is-visible')
    notification.innerHTML = msg
    notification.opened = true
    
    if(msg === 'Login exitoso') {
        window.api.send('openMainWindow')
    }
    
})
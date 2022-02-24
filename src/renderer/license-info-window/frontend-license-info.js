const btnCerrar = document.getElementById('btn-cerrar')

//.............Events ...............

btnCerrar.addEventListener('click', closeWindow)


window.addEventListener('load', async () => {
    
    getLicenseID()
    getAgreement()
    
})


//............. functions .............

function getLicenseID() {
    window.api.invoke('getLicenseID').then(
        (res) => document.getElementById('license-code').value = res,
        (rej) => document.getElementById('license-code').value = 'error'
    )

}

function getAgreement() {
    window.api.invoke('getContractAgreement').then(
        (res) => document.getElementById('contract').innerText = res,
        (rej) => document.getElementById('contract').innerText = 'error'
    )
}

function closeWindow() {
    window.close()
}